export type Country = 'PE' | 'CL';
export type AppointmentStatus = 'pending' | 'completed';

export interface Request {
  insuredId: string;
  scheduleId: number;
  countryISO: Country;
}
export interface Appointment extends Request {
  appointmentId: string;
  status: AppointmentStatus;
  createdAt: string;
}

export interface Event extends Request {
  version: 1;
  type: 'appointment.requested';
  eventId: string;
  appointmentId: string;
  correlationId: string;
  occurredAt: string;
}

export type CompletionEvent = Omit<Event, 'type'> & { type: 'appointment.completed' };
