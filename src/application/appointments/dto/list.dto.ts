import type { Appointment, Request } from '@domain/appointments/index';

export type ListAppointmentsDto = Pick<Request, 'insuredId'> & { limit?: number; cursor?: string };

export type Page = { items: Appointment[]; cursor?: string };
