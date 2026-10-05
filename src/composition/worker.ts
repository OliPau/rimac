import type { SQSEvent } from 'aws-lambda';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { createPool } from 'mysql2/promise';
import { ProcessAppointment } from '@application/appointments/use-cases/process';
import type { Country } from '@domain/appointments/index';
import { CompletionPublisher } from '@infrastructure/messaging/publish';
import { MysqlClient } from '@infrastructure/persistence/mysql/client';
import { mysqlCredentials } from '@infrastructure/persistence/mysql/credentials';
import { MysqlStore } from '@infrastructure/persistence/mysql/repository';
import { countryHandler } from '@infrastructure/sqs/country';
import { env, logger } from './config.ts';
import { errorDetails } from '@infrastructure/shared/error';

function workerCountry(value: string): Country {
  if (value !== 'PE' && value !== 'CL') {
    throw new Error('Invalid worker country');
  }
  return value;
}
const country = workerCountry(env('COUNTRY'));

let handler: Promise<ReturnType<typeof countryHandler>> | undefined;

async function makeHandler(countryISO: Country) {
  const secret = await mysqlCredentials(
    new SecretsManagerClient({ maxAttempts: 2 }),
    env('SQL_SECRET_ARN'),
  );
  if (secret.database !== `appointments_${countryISO.toLowerCase()}`) {
    throw new Error('MySQL secret targets a different country');
  }
  const pool = createPool({
    host: secret.host,
    port: secret.port,
    user: secret.user,
    password: secret.password,
    database: secret.database,
    ssl: { ca: secret.ca, rejectUnauthorized: true, verifyIdentity: true },
    namedPlaceholders: true,
    connectionLimit: 1,
  });
  const process = new ProcessAppointment(
    countryISO,
    new MysqlStore(new MysqlClient(pool)),
    new CompletionPublisher(new EventBridgeClient({ maxAttempts: 2 }), env('EVENT_BUS')),
  );
  return countryHandler(process, countryISO, logger);
}

export async function handleCountry(event: SQSEvent) {
  handler ??= makeHandler(country).catch((error: unknown) => {
    handler = undefined;
    logger.error('WorkerInitializationFailed', {
      ...errorDetails(error),
      country,
      operation: 'InitializeWorker',
    });
    throw new Error('Worker initialization failed');
  });
  return (await handler)(event);
}
