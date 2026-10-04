import type { Pool } from 'mysql2/promise';
import type { Sql } from './repository.ts';

export class MysqlClient implements Sql {
  constructor(private readonly pool: Pick<Pool, 'execute'>) {}

  async execute(sql: string, parameters: Record<string, string | number>) {
    const [rows] = await this.pool.execute(sql, parameters);
    return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  }
}
