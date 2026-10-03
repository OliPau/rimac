import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { project } from '../infra/config.ts';

const stack = `${project.service}-${project.stage}`;
const output = execFileSync(
  'aws',
  [
    'cloudformation',
    'describe-stacks',
    '--stack-name',
    stack,
    '--region',
    project.region,
    '--query',
    "Stacks[0].Outputs[?OutputKey=='HttpApiUrl'].OutputValue | [0]",
    '--output',
    'text',
  ],
  { encoding: 'utf8' },
).trim();

assert.ok(output && output !== 'None', `HttpApiUrl is missing from ${stack}`);
assert.equal(new URL(output).protocol, 'https:', 'HttpApiUrl must use HTTPS');
console.log(output);
