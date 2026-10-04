import type { Appointment, CompletionEvent, Event, Request } from '@domain/appointments/index';
import type { Acceptance } from '../dto/create.dto.ts';

export interface Appointments {
  create(input: Request): Promise<Acceptance>;
  list(insuredId: string): Promise<{ items: Appointment[] }>;
  confirm(event: CompletionEvent): Promise<void>;
}

export interface CountryStore {
  save(event: Event): Promise<void>;
}
