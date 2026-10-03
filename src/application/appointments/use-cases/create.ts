import type { CreateAppointmentDto } from '../dto/create.dto.ts';
import type { Appointments } from '../ports/repositories.ts';

export class CreateAppointment {
  constructor(private readonly appointments: Pick<Appointments, 'create'>) {}

  execute(input: CreateAppointmentDto) {
    return this.appointments.create(input);
  }
}
