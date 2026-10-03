import { afterEach, expect, test } from '@jest/globals';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { identity } from '@domain/appointments/index';
import { DynamoAppointments } from '@infrastructure/persistence/dynamo/repository';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const mock = mockClient(client);
const input = { insuredId: '00123', scheduleId: 100, countryISO: 'PE' as const };

afterEach(() => {
  mock.reset();
});

test('inserts a new appointment only when the key is absent', async () => {
  mock.on(GetCommand).resolves({});
  mock.on(PutCommand).resolves({});
  const store = new DynamoAppointments(client, 'appointments');

  const result = await store.create(input);
  expect(result.status).toBe('pending');
  expect(mock.commandCalls(GetCommand)[0]?.args[0].input).toMatchObject({
    Key: { insuredId: input.insuredId, appointmentId: result.appointmentId },
    ConsistentRead: true,
  });
  expect(mock.commandCalls(PutCommand)[0]?.args[0].input).toMatchObject({
    Item: { ...input, appointmentId: result.appointmentId, status: 'pending' },
    ConditionExpression: 'attribute_not_exists(appointmentId)',
  });
});

test('returns the saved status and date without another write', async () => {
  const appointmentId = identity(input).appointmentId;
  mock.on(GetCommand).resolves({
    Item: { ...input, appointmentId, status: 'completed', createdAt: '2026-01-01T00:00:00.000Z' },
  });

  const result = await new DynamoAppointments(client, 'appointments').create(input);
  expect(result).toEqual({
    appointmentId,
    status: 'completed',
    createdAt: '2026-01-01T00:00:00.000Z',
    message: 'El agendamiento ya fue confirmado.',
  });
  expect(mock.commandCalls(PutCommand)).toHaveLength(0);
});

test('reads the stored appointment after a conditional conflict and propagates storage errors', async () => {
  const appointmentId = identity(input).appointmentId;
  mock
    .on(GetCommand)
    .resolvesOnce({})
    .resolves({
      Item: { ...input, appointmentId, status: 'pending', createdAt: '2026-01-01T00:00:00.000Z' },
    });
  const conflict = new Error('Appointment already exists');
  conflict.name = 'ConditionalCheckFailedException';
  mock.on(PutCommand).rejects(conflict);

  const store = new DynamoAppointments(client, 'appointments');
  expect(await store.create(input)).toMatchObject({
    appointmentId,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  expect(mock.commandCalls(GetCommand)).toHaveLength(2);

  mock.reset();
  mock.on(GetCommand).resolves({});
  mock.on(PutCommand).rejects(new Error('Storage unavailable'));
  await expect(store.create(input)).rejects.toThrow('Storage unavailable');
});
