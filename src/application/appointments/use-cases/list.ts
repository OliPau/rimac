import type { ListAppointmentsDto } from '../dto/list.dto.ts';
import type { Appointments } from '../ports/repositories.ts';

export class ListAppointments {
  constructor(private readonly appointments: Pick<Appointments, 'list'>) {}

  execute(input: ListAppointmentsDto) {
    return this.appointments.list(input.insuredId, input.limit ?? 20, input.cursor);
  }
}
