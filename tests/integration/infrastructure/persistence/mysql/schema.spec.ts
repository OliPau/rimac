import { randomUUID } from 'node:crypto';
import { afterAll, expect, test } from '@jest/globals';
import { createConnection } from 'mysql2/promise';

const connection = await createConnection({
  host: '127.0.0.1',
  port: 3307,
  user: 'test',
  password: 'local-only-test',
  database: 'appointments_pe',
});

afterAll(() => connection.end());

test('loads the local schema and rejects a duplicate business appointment', async () => {
  const insuredId = '00123';
  const scheduleId = Date.now();
  const createdAt = new Date().toISOString();
  const insert =
    'INSERT INTO appointments (id, insured_id, schedule_id, country_iso, created_at) VALUES (?, ?, ?, ?, ?)';

  try {
    await connection.execute(insert, [randomUUID(), insuredId, scheduleId, 'PE', createdAt]);
    await expect(
      connection.execute(insert, [randomUUID(), insuredId, scheduleId, 'PE', createdAt]),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
    await connection.execute(insert, [randomUUID(), insuredId, scheduleId, 'CL', createdAt]);
  } finally {
    await connection.execute('DELETE FROM appointments WHERE insured_id = ? AND schedule_id = ?', [
      insuredId,
      scheduleId,
    ]);
  }
});
