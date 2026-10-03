import type { Event } from '@domain/appointments/index';

export interface Publisher {
  publish(event: Event): Promise<void>;
}
