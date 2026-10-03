import type { Event } from '@domain/appointments/index';
import type { CountryStore } from '@application/appointments/ports/repositories';

type Parameters = Record<string, string | number>;

export interface Sql {
  execute(sql: string, parameters: Parameters): Promise<Record<string, unknown>[]>;
}

export class MysqlStore implements CountryStore {
  constructor(private readonly database: Sql) {}

  async save(event: Event): Promise<void> {
    await this.database.execute(
      `INSERT IGNORE INTO appointments
         (id, insured_id, schedule_id, country_iso, created_at)
       VALUES (:id, :insured, :schedule, :country, :created)`,
      {
        id: event.appointmentId,
        insured: event.insuredId,
        schedule: event.scheduleId,
        country: event.countryISO,
        created: event.occurredAt,
      },
    );

    const [saved] = await this.database.execute(
      'SELECT insured_id, schedule_id, country_iso, created_at FROM appointments WHERE id = :id',
      { id: event.appointmentId },
    );
    if (
      !saved ||
      saved.insured_id !== event.insuredId ||
      Number(saved.schedule_id) !== event.scheduleId ||
      saved.country_iso !== event.countryISO ||
      saved.created_at !== event.occurredAt
    ) {
      throw new Error('Conflicting country appointment');
    }
  }
}
