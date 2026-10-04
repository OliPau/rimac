import type { CompletionEvent, Event, Request } from '@domain/appointments/index';
import type { Acceptance } from '../dto/create.dto.ts';
import type { Page } from '../dto/list.dto.ts';

export interface Appointments {
  create(input: Request): Promise<Acceptance>;
  list(insuredId: string, limit: number, cursor?: string): Promise<Page>;
  confirm(event: CompletionEvent): Promise<void>;
}

export interface CountryStore {
  save(event: Event): Promise<void>;
}
