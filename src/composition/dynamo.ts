import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoAppointments } from '@infrastructure/persistence/dynamo/repository';
import { env } from './config.ts';

export const appointments = new DynamoAppointments(
  DynamoDBDocumentClient.from(new DynamoDBClient({ maxAttempts: 3 })),
  env('APPOINTMENTS_TABLE'),
);
