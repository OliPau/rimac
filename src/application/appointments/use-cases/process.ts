import type { Country, Event } from '@domain/appointments/index';
import type { CountryStore } from '../ports/repositories.ts';

export class ProcessAppointment {
  constructor(
    private readonly country: Country,
    private readonly store: CountryStore,
  ) {}

  async execute(event: Event): Promise<void> {
    if (event.countryISO !== this.country) {
      throw new Error('Unexpected appointment country');
    }
    await this.store.save(event);
  }
}
