import { GetSecretValueCommand, type SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { z } from 'zod';

const credentials = z.strictObject({
  host: z.string().min(1),
  port: z.number().int().positive(),
  user: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
  ca: z.string().startsWith('-----BEGIN CERTIFICATE-----'),
});

export async function mysqlCredentials(client: SecretsManagerClient, secretArn: string) {
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!response.SecretString) {
    throw new Error('MySQL secret has no value');
  }
  return credentials.parse(JSON.parse(response.SecretString));
}
