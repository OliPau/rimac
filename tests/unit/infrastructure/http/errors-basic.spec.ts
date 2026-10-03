import { afterEach, expect, jest, test } from '@jest/globals';
import { CreateAppointment } from '@application/appointments/use-cases/create';
import { ListAppointments } from '@application/appointments/use-cases/list';

import { httpHandler } from '@infrastructure/http/handler';
import { MemoryAppointments } from '../../../support/memory-appointments.ts';
import { http } from '../../../support/fixtures.ts';
afterEach(() => {
  jest.restoreAllMocks();
});
test('translates routing and dependency failures without exposing their causes', async () => {
  const store = new MemoryAppointments();
  const create = new CreateAppointment(store);
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
      body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE' } }),
    });
    expect(report).toHaveBeenLastCalledWith(name);
  }
});
