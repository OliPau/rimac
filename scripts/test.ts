import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { testConfig } from '../tests/config/jest.ts';

const [mode = 'unit', ...args] = process.argv.slice(2);
if (!['unit', 'integration', 'coverage'].includes(mode)) {
  throw new Error('Expected unit, integration or coverage');
}
const require = createRequire(import.meta.url);
const result = spawnSync(
  process.execPath,
  [
    '--experimental-vm-modules',
    require.resolve('jest/bin/jest'),
    '--config',
    JSON.stringify(testConfig(mode)),
    ...args,
  ],
  { stdio: 'inherit' },
);
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
