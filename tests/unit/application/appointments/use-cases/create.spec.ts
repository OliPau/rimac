import { expect, test } from '@jest/globals';
import { CreateAppointment } from '@application/appointments/use-cases/create';
import { identity } from '@domain/appointments/index';
import { MemoryAppointments } from '../../../../support/memory-appointments.ts';

test('registers a pending appointment and returns the same one on retry', async () => {
  const store = new MemoryAppointments();
  const create = new CreateAppointment(store);
  const input = { insuredId: '00123', scheduleId: 100, countryISO: 'PE' as const };

  const first = await create.execute(input);
  expect(first).toMatchObject({
    appointmentId: identity(input).appointmentId,
    status: 'pending',
    message: 'El agendamiento está en proceso.',
  });
  expect(Number.isNaN(Date.parse(first.createdAt))).toBe(false);
  expect(await create.execute(input)).toEqual(first);
  expect(store.items.size).toBe(1);
});

test('keeps different requests as separate appointments', async () => {
  const store = new MemoryAppointments();
  const create = new CreateAppointment(store);
  const input = { insuredId: '00123', scheduleId: 100, countryISO: 'PE' as const };

  const results = await Promise.all([
    create.execute(input),
    create.execute({ ...input, insuredId: '00124' }),
    create.execute({ ...input, scheduleId: 101 }),
    create.execute({ ...input, countryISO: 'CL' }),
  ]);
  expect(new Set(results.map((result) => result.appointmentId)).size).toBe(4);
  expect(store.items.size).toBe(4);
});

test('returns the stored completed status on a later retry', async () => {
  const store = new MemoryAppointments();
  const create = new CreateAppointment(store);
  const input = { insuredId: '00123', scheduleId: 100, countryISO: 'PE' as const };
  const first = await create.execute(input);
  const stored = store.items.get(first.appointmentId);
  if (!stored) {
    throw new Error('Expected the appointment to be stored');
  }
  stored.status = 'completed';

  expect(await create.execute(input)).toEqual({
    ...first,
    status: 'completed',
    message: 'El agendamiento ya fue confirmado.',
  });
  expect(store.items.size).toBe(1);
});
