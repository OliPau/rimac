import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, expect, test } from '@jest/globals';
import { createPool, type RowDataPacket } from 'mysql2/promise';
import { MysqlClient } from '@infrastructure/persistence/mysql/client';
import { MysqlStore } from '@infrastructure/persistence/mysql/repository';
import { event } from '../../../../support/fixtures.ts';

const pool = createPool({
  host: '127.0.0.1',
  port: 3307,
  user: 'test',
  password: 'local-only-test',
  database: 'appointments_pe',
  namedPlaceholders: true,
  connectionLimit: 1,
});
const store = new MysqlStore(new MysqlClient(pool));

afterAll(() => pool.end());

test('keeps one row per country and rejects a conflicting appointment', async () => {
  const insuredId = String(randomInt(100000)).padStart(5, '0');
  const scheduleId = Date.now();
  const pe = { ...event, insuredId, scheduleId, appointmentId: randomUUID() };
  const cl = { ...pe, countryISO: 'CL' as const, appointmentId: randomUUID() };

  try {
    await store.save(pe);
    await store.save(pe);
    await store.save(cl);
    await expect(store.save({ ...pe, appointmentId: randomUUID() })).rejects.toThrow(
      'Conflicting country appointment',
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT id, country_iso FROM appointments WHERE insured_id = ? AND schedule_id = ?',
      [insuredId, scheduleId],
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: pe.appointmentId, country_iso: 'PE' }),
        expect.objectContaining({ id: cl.appointmentId, country_iso: 'CL' }),
      ]),
    );
    expect(rows).toHaveLength(2);
  } finally {
    await pool.execute('DELETE FROM appointments WHERE insured_id = ? AND schedule_id = ?', [
      insuredId,
      scheduleId,
    ]);
  }
});
