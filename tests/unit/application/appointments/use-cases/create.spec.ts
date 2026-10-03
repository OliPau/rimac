import { expect, jest, test } from '@jest/globals';
import { CreateAppointment } from '@application/appointments/use-cases/create';
import type { Publisher } from '@application/appointments/ports/messaging';
import { identity } from '@domain/appointments/index';
import { MemoryAppointments } from '../../../../support/memory-appointments.ts';

test('registers a pending appointment and returns the same one on retry', async () => {
  const store = new MemoryAppointments();
  const publish = jest.fn<Publisher['publish']>().mockResolvedValue(undefined);
  const create = new CreateAppointment(store, { publish });
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
  expect(publish).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenCalledWith(
    expect.objectContaining({
      ...input,
      appointmentId: first.appointmentId,
      occurredAt: first.createdAt,
      type: 'appointment.requested',
      eventId: expect.any(String),
      correlationId: expect.any(String),
    }),
  );
});

test('keeps different requests as separate appointments', async () => {
  const store = new MemoryAppointments();
  const create = new CreateAppointment(store, { publish: () => Promise.resolve() });
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
  const publish = jest.fn<Publisher['publish']>().mockResolvedValue(undefined);
  const create = new CreateAppointment(store, { publish });
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
  expect(publish).toHaveBeenCalledTimes(1);
});

test('keeps the pending appointment when SNS fails and publishes on retry', async () => {
  const store = new MemoryAppointments();
  const publish = jest
    .fn<Publisher['publish']>()
    .mockRejectedValueOnce(new Error('SNS unavailable'))
    .mockResolvedValue(undefined);
  const create = new CreateAppointment(store, { publish });
  const input = { insuredId: '00123', scheduleId: 100, countryISO: 'PE' as const };

  await expect(create.execute(input)).rejects.toThrow('SNS unavailable');
  const saved = store.items.get(identity(input).appointmentId);
  expect(saved?.status).toBe('pending');

  expect(await create.execute(input)).toMatchObject({
    appointmentId: saved?.appointmentId,
    createdAt: saved?.createdAt,
    status: 'pending',
  });
  expect(store.items.size).toBe(1);
  expect(publish).toHaveBeenCalledTimes(2);
});
