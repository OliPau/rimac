import type { Appointment, CompletionEvent, Request } from '@domain/appointments/index';
import { identity } from '@domain/appointments/index';
import { accept } from '@application/appointments/helpers/registration';
import type { Appointments } from '@application/appointments/ports/repositories';

export class MemoryAppointments implements Appointments {
  readonly items = new Map<string, Appointment>();

  create(input: Request) {
    const { appointmentId } = identity(input);
    let item = this.items.get(appointmentId);
    if (!item) {
      item = { ...input, appointmentId, status: 'pending', createdAt: new Date().toISOString() };
      this.items.set(appointmentId, item);
    }
    return Promise.resolve(accept(item.appointmentId, item.createdAt, item.status));
  }

  confirm(event: CompletionEvent) {
    const current = this.items.get(event.appointmentId);
    if (
      !current ||
      current.insuredId !== event.insuredId ||
      current.countryISO !== event.countryISO ||
      current.scheduleId !== event.scheduleId
    ) {
      return Promise.reject(new Error('Missing or conflicting appointment'));
    }
    current.status = 'completed';
    return Promise.resolve();
  }

  list(insuredId: string) {
    return Promise.resolve({
      items: [...this.items.values()].filter((item) => item.insuredId === insuredId),
    });
  }
}
