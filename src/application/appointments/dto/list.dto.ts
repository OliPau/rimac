import type { Request } from '@domain/appointments/index';

export type ListAppointmentsDto = Pick<Request, 'insuredId'>;
