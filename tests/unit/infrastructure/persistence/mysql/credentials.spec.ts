import { afterAll, beforeEach, expect, test } from '@jest/globals';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { mysqlCredentials } from '@infrastructure/persistence/mysql/credentials';

const client = new SecretsManagerClient({});
const mock = mockClient(client);
const arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:worker';
const value = {
  host: 'mysql.example.test',
  port: 3306,
  user: 'rimac_pe',
  password: 'local-test-password',
  database: 'appointments_pe',
  ca: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
};

beforeEach(() => {
  mock.reset();
});
afterAll(() => client.destroy());

test('loads and validates the worker database secret', async () => {
  mock
    .on(GetSecretValueCommand, { SecretId: arn })
    .resolves({ SecretString: JSON.stringify(value) });
  await expect(mysqlCredentials(client, arn)).resolves.toEqual(value);
});

test('rejects a missing or incomplete database secret', async () => {
  mock
    .on(GetSecretValueCommand, { SecretId: arn })
    .resolvesOnce({})
    .resolves({
      SecretString: JSON.stringify({ ...value, ca: undefined }),
    });
  await expect(mysqlCredentials(client, arn)).rejects.toThrow('MySQL secret has no value');
  await expect(mysqlCredentials(client, arn)).rejects.toThrow();
});
