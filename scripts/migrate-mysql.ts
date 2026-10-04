import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'mysql2/promise';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const uri = process.env.MYSQL_URL;
const caFile = process.env.MYSQL_CA_FILE;
if (!uri || !caFile) {
  throw new Error('MYSQL_URL and MYSQL_CA_FILE are required');
}

const endpoint = new URL(uri);
if (endpoint.protocol !== 'mysql:') {
  throw new Error('MYSQL_URL must use mysql://');
}

const schema = readFileSync(new URL('../infra/migrations/001.sql', import.meta.url), 'utf8');
const ca = readFileSync(caFile, 'utf8');

for (const database of ['appointments_pe', 'appointments_cl']) {
  const connection = await createConnection({
    host: endpoint.hostname,
    port: Number(endpoint.port || 3306),
    user: decodeURIComponent(endpoint.username),
    password: decodeURIComponent(endpoint.password),
    database,
    ssl: { ca, rejectUnauthorized: true, verifyIdentity: true },
  });
  try {
    await connection.query(schema);
    console.log(`${database}: schema ready`);
  } finally {
    await connection.end();
  }
}
