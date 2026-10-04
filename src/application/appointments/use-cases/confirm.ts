import type { CompletionEvent, Event } from '@domain/appointments/index';
import type { Appointments } from '../ports/repositories.ts';

export class ConfirmAppointment {
  constructor(private readonly appointments: Appointments) {}

  async execute(event: Event | CompletionEvent): Promise<void> {
    if (event.type !== 'appointment.completed') {
      throw new Error('Unexpected confirmation type');
    }
    await this.appointments.confirm(event);
  }
}
