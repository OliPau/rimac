import type { AppointmentStatus, Request } from '@domain/appointments/index';

export type CreateAppointmentDto = Request;

export interface Acceptance {
  appointmentId: string;
  status: AppointmentStatus;
  message: string;
  createdAt: string;
}
