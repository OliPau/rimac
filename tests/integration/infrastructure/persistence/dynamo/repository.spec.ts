import { randomInt } from 'node:crypto';
import { afterAll, expect, test } from '@jest/globals';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { CreateAppointment } from '@application/appointments/use-cases/create';
import { identity } from '@domain/appointments/index';
import { DynamoAppointments } from '@infrastructure/persistence/dynamo/repository';

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: 'us-east-1',
    endpoint: 'http://127.0.0.1:8000',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  }),
);
const table = 'rimac-learning-appointments';

afterAll(() => client.destroy());

test('keeps one stored appointment through concurrent retries and completion', async () => {
  const input = {
    insuredId: randomInt(100_000).toString().padStart(5, '0'),
    scheduleId: Date.now(),
    countryISO: 'PE' as const,
  };
  const store = new DynamoAppointments(client, table);
  const create = new CreateAppointment(store, { publish: () => Promise.resolve() });
  const results = await Promise.all(Array.from({ length: 5 }, () => create.execute(input)));
  const first = results[0];
  if (!first) {
    throw new Error('Expected an appointment');
  }
  expect(first).toMatchObject({ appointmentId: identity(input).appointmentId, status: 'pending' });
  expect(results).toEqual(Array.from({ length: 5 }, () => first));

  const key = { insuredId: input.insuredId, appointmentId: first.appointmentId };
  const saved = await client.send(
    new GetCommand({ TableName: table, Key: key, ConsistentRead: true }),
  );
  expect(saved.Item).toMatchObject({
    ...input,
    ...key,
    status: 'pending',
    createdAt: first.createdAt,
  });

  const confirmation = {
    version: 1 as const,
    type: 'appointment.completed' as const,
    ...input,
    appointmentId: first.appointmentId,
    eventId: '10000000-0000-4000-8000-000000000002',
    correlationId: '10000000-0000-4000-8000-000000000003',
    occurredAt: '2026-10-03T12:00:00.000Z',
  };
  await store.confirm(confirmation);
  await store.confirm(confirmation);
  await expect(store.confirm({ ...confirmation, countryISO: 'CL' })).rejects.toMatchObject({
    name: 'ConditionalCheckFailedException',
  });
  const absentId = '10000000-0000-4000-8000-000000000099';
  await expect(store.confirm({ ...confirmation, appointmentId: absentId })).rejects.toMatchObject({
    name: 'ConditionalCheckFailedException',
  });
  expect(
    (
      await client.send(
        new GetCommand({ TableName: table, Key: { ...key, appointmentId: absentId } }),
      )
    ).Item,
  ).toBeUndefined();
  expect(await create.execute(input)).toEqual({
    ...first,
    status: 'completed',
    message: 'El agendamiento ya fue confirmado.',
  });

  const otherInsuredId = String((Number(input.insuredId) + 1) % 100_000).padStart(5, '0');
  await create.execute({ ...input, insuredId: otherInsuredId });
  expect(await store.list(input.insuredId)).toMatchObject({
    items: [
      { insuredId: input.insuredId, appointmentId: first.appointmentId, status: 'completed' },
    ],
  });
  expect(await store.list('not-stored')).toEqual({ items: [] });
});
