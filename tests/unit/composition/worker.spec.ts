import { afterEach, expect, jest, test } from '@jest/globals';
import { mockClient } from 'aws-sdk-client-mock';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Logger } from '@aws-lambda-powertools/logger';
import { sqs } from '../../support/fixtures.ts';

const secrets = mockClient(SecretsManagerClient);
afterEach(() => {
  secrets.reset();
  jest.restoreAllMocks();
});

test('logs initialization failures safely and retries initialization on the next invocation', async () => {
  jest.replaceProperty(process, 'env', {
    ...process.env,
    COUNTRY: 'PE',
    SQL_SECRET_ARN: 'sql-secret',
  });
  const report = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const failure = Object.assign(new Error('private credentials'), {
    name: 'AccessDeniedException',
  });
  secrets.on(GetSecretValueCommand).rejects(failure);
  const { handleCountry } = await import('../../../src/composition/worker.ts');
  await expect(handleCountry(sqs())).rejects.toThrow('Worker initialization failed');
  await expect(handleCountry(sqs())).rejects.toThrow('Worker initialization failed');
  expect(secrets.commandCalls(GetSecretValueCommand)).toHaveLength(2);
  expect(report).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenCalledWith(
    'WorkerInitializationFailed',
    expect.objectContaining({
      country: 'PE',
      errorName: 'AccessDeniedException',
      operation: 'InitializeWorker',
    }),
  );
  expect(JSON.stringify(report.mock.calls)).not.toContain('private credentials');
});
