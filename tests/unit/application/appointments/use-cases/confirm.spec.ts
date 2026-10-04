import { expect, test } from '@jest/globals';
import { ConfirmAppointment } from '@application/appointments/use-cases/confirm';
import { MemoryAppointments } from '../../../../support/memory-appointments.ts';
import { event } from '../../../../support/fixtures.ts';

test('completes a matching appointment and accepts a repeated confirmation', async () => {
  const appointments = new MemoryAppointments();
  const input = { insuredId: '00123', scheduleId: 123, countryISO: 'PE' as const };
  const created = await appointments.create(input);
  const confirm = new ConfirmAppointment(appointments);
  const message = {
    ...event,
    ...input,
    appointmentId: created.appointmentId,
    type: 'appointment.completed' as const,
  };

  await confirm.execute(message);
  await confirm.execute(message);
  expect(await appointments.list(input.insuredId)).toMatchObject({
    items: [
      { appointmentId: created.appointmentId, createdAt: created.createdAt, status: 'completed' },
    ],
  });
});

test('rejects a request event, an absent appointment and a conflicting country', async () => {
  const appointments = new MemoryAppointments();
  const confirm = new ConfirmAppointment(appointments);
  await expect(confirm.execute(event)).rejects.toThrow('Unexpected confirmation type');
  await expect(confirm.execute({ ...event, type: 'appointment.completed' })).rejects.toThrow(
    'Missing or conflicting appointment',
  );

  const created = await appointments.create({
    insuredId: '00123',
    scheduleId: 123,
    countryISO: 'PE',
  });
  await expect(
    confirm.execute({
      ...event,
      appointmentId: created.appointmentId,
      countryISO: 'CL',
      type: 'appointment.completed',
    }),
  ).rejects.toThrow('Missing or conflicting appointment');
  expect((await appointments.list('00123')).items[0]?.status).toBe('pending');
});
