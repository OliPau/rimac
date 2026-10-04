import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
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

  const readStored = async () => {
    const stored = await dynamo.send(
      new GetCommand({
        TableName: resource('appointments'),
        Key: { insuredId: input.insuredId, appointmentId: accepted.appointmentId },
        ConsistentRead: true,
      }),
    );
    return appointment.parse(stored.Item);
  };
  const storedAppointment = await readStored();
  assert.deepEqual(
    {
      insuredId: storedAppointment.insuredId,
      scheduleId: storedAppointment.scheduleId,
      countryISO: storedAppointment.countryISO,
      createdAt: storedAppointment.createdAt,
    },
    { ...input, createdAt: accepted.createdAt },
  );

  const deadline = Date.now() + 90_000;
  let completed = storedAppointment;
  while (completed.status !== 'completed' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    completed = await readStored();
  }
  assert.equal(completed.status, 'completed', `${countryISO}: confirmation was not processed`);

  const repeated = await send();
  if (repeated.status !== 200) {
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
  assert.equal(repeatedBody.status, 'completed');

  let listed = false;
  for (let attempt = 0; attempt < 15 && !listed; attempt++) {
    const result = await fetch(`${endpoint}/${input.insuredId}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (result.status !== 200) {
      throw new Error(`${countryISO}: GET returned ${result.status}: ${await result.text()}`);
    }
    const page = (await result.json()) as {
      items: { appointmentId: string; createdAt: string; status: string }[];
    };
    assert.ok(Array.isArray(page.items), `${countryISO}: GET did not return items`);
    listed = page.items.some(
      (item) =>
        item.appointmentId === accepted.appointmentId &&
        item.createdAt === accepted.createdAt &&
        item.status === 'completed',
    );
    if (!listed) {
      await delay(2000);
    }
  }
  assert.ok(listed, `${countryISO}: GET did not return the completed appointment`);

  console.log(`${countryISO}: appointment ${accepted.appointmentId} completed and listed`);
}
