import { expect, jest, test } from '@jest/globals';
import { MysqlStore, type Sql } from '@infrastructure/persistence/mysql/repository';
import { event } from '../../../../support/fixtures.ts';

test.each([
  undefined,
  {
    insured_id: '99999',
    schedule_id: event.scheduleId,
    country_iso: 'PE',
    created_at: event.occurredAt,
  },
  {
    insured_id: event.insuredId,
    schedule_id: 999,
    country_iso: 'PE',
    created_at: event.occurredAt,
  },
  {
    insured_id: event.insuredId,
    schedule_id: event.scheduleId,
    country_iso: 'CL',
    created_at: event.occurredAt,
  },
  {
    insured_id: event.insuredId,
    schedule_id: event.scheduleId,
    country_iso: 'PE',
    created_at: '2026-01-01T00:00:00.000Z',
  },
])('rejects a missing or conflicting saved appointment', async (saved) => {
  const execute = jest
    .fn<Sql['execute']>()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce(saved ? [saved] : []);

  await expect(new MysqlStore({ execute }).save(event)).rejects.toThrow(
    'Conflicting country appointment',
  );
  expect(execute).toHaveBeenCalledTimes(2);
});
