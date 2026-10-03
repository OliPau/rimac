import { afterEach, expect, jest, test } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { http } from '../../support/fixtures.ts';

const client = mockClient(DynamoDBDocumentClient);

afterEach(() => {
  client.reset();
  jest.restoreAllMocks();
});

test('connects the Lambda entrypoint to DynamoDB and reports storage failures', async () => {
  jest.replaceProperty(process, 'env', { ...process.env, APPOINTMENTS_TABLE: 'appointments' });
  const report = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  client.on(GetCommand).resolves({});
  client.on(PutCommand).resolves({});

  const { handler } = await import('../../../src/handlers/appointment.ts');
  const event = http(
    'POST /appointments',
    JSON.stringify({ insuredId: '00123', scheduleId: 12, countryISO: 'PE' }),
  );
  expect(await handler(event)).toMatchObject({ statusCode: 202 });
  expect(client.commandCalls(PutCommand)).toHaveLength(1);

  client.on(GetCommand).rejects(new Error('Storage unavailable'));
  expect(await handler(event)).toMatchObject({ statusCode: 503 });
  expect(report).toHaveBeenCalledWith('RequestFailed', { errorName: 'Error' });
});

test('requires the appointment table name', async () => {
  const { env } = await import('../../../src/composition/config.ts');
  expect(() => env('MISSING_TEST_CONFIGURATION')).toThrow('Missing configuration');
});
