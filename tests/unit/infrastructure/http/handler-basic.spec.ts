import { expect, test, jest } from '@jest/globals';
import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { CreateAppointment } from '@application/appointments/use-cases/create';
import { ListAppointments } from '@application/appointments/use-cases/list';
import type { Acceptance } from '@application/appointments/dto/create.dto';

import { httpHandler } from '@infrastructure/http/handler';
import { MemoryAppointments } from '../../../support/memory-appointments.ts';
import { http } from '../../../support/fixtures.ts';
function structured(result: APIGatewayProxyResultV2) {
  if (typeof result === 'string') {
    throw new Error('Expected a structured HTTP response');
  }
  return result;
}

test('returns the stored appointment and reflects its completed status on retry', async () => {
  const store = new MemoryAppointments();
  const handle = httpHandler(new CreateAppointment(store), new ListAppointments(store), () => {});
  const event = http(
    'POST /appointments',
    JSON.stringify({ insuredId: '00123', scheduleId: 100, countryISO: 'PE' }),
  );
  const first = structured(await handle(event));
  expect(first).toMatchObject({ statusCode: 202, headers: { 'content-type': 'application/json' } });
  const pending = JSON.parse(String(first.body)) as Acceptance;
  expect(pending).toMatchObject({ status: 'pending', message: 'El agendamiento está en proceso.' });
  expect(await handle(event)).toEqual(first);

  const stored = store.items.get(pending.appointmentId);
  if (!stored) {
    throw new Error('Expected the appointment to be stored');
  }
  stored.status = 'completed';
  const completed = structured(await handle(event));
  expect(completed.statusCode).toBe(200);
  expect(JSON.parse(String(completed.body)) as unknown).toEqual({
    ...pending,
    status: 'completed',
    message: 'El agendamiento ya fue confirmado.',
  });
  expect(store.items.size).toBe(1);
});

test('rejects invalid HTTP bodies before invoking registration', async () => {
  const store = new MemoryAppointments();
  const handle = httpHandler(new CreateAppointment(store), new ListAppointments(store), () => {});

  const execute = jest.spyOn(CreateAppointment.prototype, 'execute');
  try {
    const original = http(
      'POST /appointments',
      JSON.stringify({ insuredId: '00123', scheduleId: 100, countryISO: 'PE' }),
    );
    const cases = [
      { event: { ...original, headers: {} }, status: 415 },
      {
        event: {
          ...original,
          headers: { 'content-type': 'image/jpeg' },
          body: 'not JSON',
          isBase64Encoded: true,
        },
        status: 415,
      },
      { event: { ...original, body: 'x'.repeat(4097) }, status: 413 },
      { event: { ...original, body: '{' }, status: 400 },
      { event: { ...original, body: '{}' }, status: 400 },
      {
        event: {
          ...original,
          body: JSON.stringify({ insuredId: '00123', scheduleId: 0, countryISO: 'PE' }),
        },
        status: 400,
      },
      {
        event: {
          ...original,
          body: JSON.stringify({
            insuredId: '00123',
            scheduleId: 100,
            countryISO: 'PE',
            extra: true,
          }),
        },
        status: 400,
      },
    ];
    for (const item of cases) {
      expect(await handle(item.event)).toMatchObject({ statusCode: item.status });
    }
    expect(execute).not.toHaveBeenCalled();
  } finally {
    execute.mockRestore();
  }
});

test('explains invalid fields without invoking registration', async () => {
  const store = new MemoryAppointments();
  const create = new CreateAppointment(store);
  const execute = jest.spyOn(create, 'execute');
  const handle = httpHandler(create, new ListAppointments(store), () => {});
  const result = structured(
    await handle(
      http(
        'POST /appointments',
        JSON.stringify({ insuredId: '123', scheduleId: 0, countryISO: 'PE' }),
      ),
    ),
  );
  expect(result.statusCode).toBe(400);
  expect(JSON.parse(String(result.body)) as unknown).toMatchObject({
    error: {
      code: 'INVALID_REQUEST',
      details: [
        { field: 'insuredId', message: expect.any(String) },
        { field: 'scheduleId', message: expect.any(String) },
      ],
    },
  });
  expect(execute).not.toHaveBeenCalled();
  execute.mockRestore();
});

test('lists only the insured appointments and rejects an invalid insured ID', async () => {
  const store = new MemoryAppointments();
  const own = await store.create({ insuredId: '00123', scheduleId: 100, countryISO: 'PE' });
  await store.create({ insuredId: '00124', scheduleId: 101, countryISO: 'CL' });
  const handle = httpHandler(new CreateAppointment(store), new ListAppointments(store), () => {});
  const get = (insuredId: string) => ({
    ...http('GET /appointments/{insuredId}'),
    pathParameters: { insuredId },
  });

  const listed = structured(await handle(get('00123')));
  expect(listed.statusCode).toBe(200);
  expect(JSON.parse(String(listed.body)) as unknown).toMatchObject({
    items: [{ insuredId: '00123', appointmentId: own.appointmentId }],
  });
  expect(await handle(get('99999'))).toMatchObject({ statusCode: 200, body: '{"items":[]}' });
  expect(await handle(get('123'))).toMatchObject({
    statusCode: 400,
    body: expect.stringContaining('insuredId'),
  });
});
