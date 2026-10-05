import { afterEach, expect, jest, test } from '@jest/globals';
import { CreateAppointment } from '@application/appointments/use-cases/create';
import { ListAppointments } from '@application/appointments/use-cases/list';
import type { Publisher } from '@application/appointments/ports/messaging';

import { httpHandler } from '@infrastructure/http/handler';
import { MemoryAppointments } from '../../../support/memory-appointments.ts';
import { http } from '../../../support/fixtures.ts';
const publisher = { publish: () => Promise.resolve() };
afterEach(() => {
  jest.restoreAllMocks();
});
test('translates routing and dependency failures without exposing their causes', async () => {
  const store = new MemoryAppointments();
  const create = new CreateAppointment(store, publisher);
  const report = jest.fn();
  const handle = httpHandler(create, new ListAppointments(store), report);
  expect(await handle(http('DELETE /appointments'))).toMatchObject({ statusCode: 404 });

  const input = http(
    'POST /appointments',
    JSON.stringify({ insuredId: '00123', scheduleId: 12, countryISO: 'PE' }),
  );
  jest
    .spyOn(create, 'execute')
    .mockRejectedValueOnce(new Error('private'))
    .mockRejectedValueOnce('private');
  for (const name of ['Error', 'UnknownError']) {
    expect(await handle(input)).toMatchObject({
      statusCode: 503,
      body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', requestId: 'request' } }),
    });
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({
        errorName: name,
        requestId: 'request',
        operation: 'POST /appointments',
      }),
    );
    expect(JSON.stringify(report.mock.calls)).not.toContain('private');
  }
});

test('returns 503 when publishing fails after the appointment was saved', async () => {
  const store = new MemoryAppointments();
  const publish = jest.fn<Publisher['publish']>().mockRejectedValue(new Error('SNS unavailable'));
  const report = jest.fn();
  const handle = httpHandler(
    new CreateAppointment(store, { publish }),
    new ListAppointments(store),
    report,
  );

  const result = await handle(
    http(
      'POST /appointments',
      JSON.stringify({
        insuredId: '00123',
        scheduleId: 12,
        countryISO: 'PE',
      }),
    ),
  );
  expect(result).toMatchObject({
    statusCode: 503,
    body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', requestId: 'request' } }),
  });
  expect(store.items.size).toBe(1);
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({
      errorName: 'Error',
      requestId: 'request',
      errorStack: expect.any(Array),
    }),
  );
});
