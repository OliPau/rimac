import { writeFile } from 'node:fs/promises';
import { service } from '../infra/service.ts';

await writeFile('serverless.generated.json', JSON.stringify(service(), null, 2));
