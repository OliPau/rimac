import { randomUUID } from 'node:crypto';
import type { CreateAppointmentDto } from '../dto/create.dto.ts';
import type { Appointments } from '../ports/repositories.ts';
import type { Publisher } from '../ports/messaging.ts';
import { requested } from '../helpers/registration.ts';

export class CreateAppointment {
  constructor(
    private readonly appointments: Pick<Appointments, 'create'>,
    private readonly publisher: Publisher,
  ) {}

  async execute(input: CreateAppointmentDto) {
    const accepted = await this.appointments.create(input);
    if (accepted.status === 'pending') {
      await this.publisher.publish(requested(input, accepted, randomUUID(), randomUUID()));
    }
    return accepted;
  }
}
