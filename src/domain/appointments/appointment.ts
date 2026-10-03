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
