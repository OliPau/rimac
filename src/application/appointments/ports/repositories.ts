import type { Appointment, Request } from '@domain/appointments/index';
import type { Acceptance } from '../dto/create.dto.ts';

export interface Appointments {
  create(input: Request): Promise<Acceptance>;
  list(insuredId: string): Promise<{ items: Appointment[] }>;
}
