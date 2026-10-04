import { expect, test } from '@jest/globals';
import type { CompletionEvent, Event } from '@domain/appointments/index';
import { CreateAppointment } from '@application/appointments/use-cases/create';
import { ProcessAppointment } from '@application/appointments/use-cases/process';
import { ConfirmAppointment } from '@application/appointments/use-cases/confirm';
import { MemoryAppointments } from '../../../support/memory-appointments.ts';

test.each(['PE', 'CL'] as const)(
  'completes the %s flow after a worker retry',
  async (countryISO) => {
    const appointments = new MemoryAppointments();
    const requests: Event[] = [];
    const confirmations: CompletionEvent[] = [];
    const sql = new Map<string, Event>();
    const create = new CreateAppointment(appointments, {
      publish: async (event) => {
        requests.push(event);
      },
    });
    const worker = new ProcessAppointment(
      countryISO,
      {
        save: async (event) => {
          sql.set(event.appointmentId, event);
        },
      },
      {
        publish: async (event) => {
          confirmations.push(event);
        },
      },
    );
    const confirm = new ConfirmAppointment(appointments);
    const input = { insuredId: '00123', scheduleId: 100, countryISO };

    const accepted = await create.execute(input);
    expect(accepted.status).toBe('pending');
    expect(requests).toHaveLength(1);
    await worker.execute(requests[0]!);
    await worker.execute(requests[0]!);
    for (const event of confirmations) {
      await confirm.execute(event);
    }

    expect(sql.size).toBe(1);
    expect(confirmations).toHaveLength(2);
    expect((await appointments.list(input.insuredId)).items[0]?.status).toBe('completed');
    expect(await create.execute(input)).toEqual({
      ...accepted,
      status: 'completed',
      message: 'El agendamiento ya fue confirmado.',
    });
    expect(requests).toHaveLength(1);
  },
);
