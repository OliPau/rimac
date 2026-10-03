import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { project, resource } from '../infra/config.ts';
import { appointment } from '../src/infrastructure/shared/appointment.schema.ts';

const base = process.env.API_URL;
assert.ok(base, 'API_URL must be the deployed learning API URL');
assert.equal(new URL(base).protocol, 'https:', 'API_URL must use HTTPS');
const endpoint = `${base.replace(/\/$/, '')}/appointments`;
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: project.region }));

for (const countryISO of ['PE', 'CL'] as const) {
  const input = {
    insuredId: String(randomInt(100000)).padStart(5, '0'),
    scheduleId: randomInt(1, 1000000),
    countryISO,
  };
  const send = () =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(30000),
    });

  const first = await send();
  if (first.status !== 202) {
    throw new Error(`${countryISO}: first POST returned ${first.status}: ${await first.text()}`);
  }
  const accepted = (await first.json()) as {
    appointmentId: string;
    createdAt: string;
    status: string;
  };
  assert.ok(accepted.appointmentId, `${countryISO}: appointmentId is missing`);
  assert.ok(accepted.createdAt, `${countryISO}: createdAt is missing`);
  assert.equal(accepted.status, 'pending');

  const stored = await dynamo.send(
    new GetCommand({
      TableName: resource('appointments'),
      Key: { insuredId: input.insuredId, appointmentId: accepted.appointmentId },
      ConsistentRead: true,
    }),
  );
  const storedAppointment = appointment.parse(stored.Item);
  assert.deepEqual(
    {
      insuredId: storedAppointment.insuredId,
      scheduleId: storedAppointment.scheduleId,
      countryISO: storedAppointment.countryISO,
      status: storedAppointment.status,
      createdAt: storedAppointment.createdAt,
    },
    { ...input, status: 'pending', createdAt: accepted.createdAt },
  );

  const repeated = await send();
  if (repeated.status !== 202) {
    throw new Error(
      `${countryISO}: repeated POST returned ${repeated.status}: ${await repeated.text()}`,
    );
  }
  const repeatedBody = (await repeated.json()) as {
    appointmentId: string;
    createdAt: string;
    status: string;
  };
  assert.equal(repeatedBody.appointmentId, accepted.appointmentId);
  assert.equal(repeatedBody.createdAt, accepted.createdAt);
  assert.equal(repeatedBody.status, 'pending');

  console.log(`${countryISO}: appointment ${accepted.appointmentId} persisted and repeated`);
}
