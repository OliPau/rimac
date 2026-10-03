import type { Country, Event } from '@domain/appointments/index';
import type { ConfirmationPublisher } from '../ports/messaging.ts';
import type { CountryStore } from '../ports/repositories.ts';

export class ProcessAppointment {
  constructor(
    private readonly country: Country,
    private readonly store: CountryStore,
    private readonly confirmations: ConfirmationPublisher,
  ) {}

  async execute(event: Event): Promise<void> {
    if (event.countryISO !== this.country) {
      throw new Error('Unexpected appointment country');
    }
    await this.store.save(event);
    await this.confirmations.publish({ ...event, type: 'appointment.completed' });
  }
}
