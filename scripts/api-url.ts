import assert from 'node:assert/strict';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { project } from '../infra/config.ts';

const stack = `${project.service}-${project.stage}`;
const client = new CloudFormationClient({ region: project.region });
const { Stacks } = await client.send(new DescribeStacksCommand({ StackName: stack }));
const output = Stacks?.[0]?.Outputs?.find(
  ({ OutputKey }) => OutputKey === 'HttpApiUrl',
)?.OutputValue;

assert.ok(output, `HttpApiUrl is missing from ${stack}`);
assert.equal(new URL(output).protocol, 'https:', 'HttpApiUrl must use HTTPS');
console.log(output);
