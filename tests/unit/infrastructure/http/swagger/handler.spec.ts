import { randomBytes } from 'node:crypto';
import { afterEach, expect, jest, test } from '@jest/globals';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { mockClient } from 'aws-sdk-client-mock';
import { authorized, secretCredentials } from '@infrastructure/http/swagger/credentials';
import { swaggerAssets } from '@infrastructure/http/swagger/assets';
import { swaggerHandler } from '@infrastructure/http/swagger/handler';
import { http } from '../../../../support/fixtures.ts';

const expected = { username: 'admin', password: randomBytes(24).toString('hex') };
const basic = (value: string) => `Basic ${Buffer.from(value).toString('base64')}`;
const authorization = basic(`${expected.username}:${expected.password}`);

function event(path = '/swagger/index.html', header?: string, method = 'GET') {
  const fixture = http('GET /swagger/{proxy+}');
  return {
    ...fixture,
    rawPath: path,
    headers: header === undefined ? {} : { Authorization: header },
    requestContext: {
      ...fixture.requestContext,
      http: { ...fixture.requestContext.http, method },
    },
  };
}

afterEach(() => {
  jest.useRealTimers();
});

test('compares the complete Basic credential and rejects malformed headers', () => {
  expect(authorized(authorization, expected)).toBe(true);
  expect(authorized(authorization.replace('Basic', 'basic'), expected)).toBe(true);
  for (const header of [
    undefined,
    '',
    'x'.repeat(4097),
    'Bearer token',
    'Basic !!!',
    'Basic YR==',
    basic('admin:wrong'),
    basic('admin'),
  ]) {
    expect(authorized(header, expected)).toBe(false);
  }
});

test('protects every asset and only serves known GET routes', async () => {
  const load = jest.fn(async () => 'asset');
  const report = jest.fn();
  const handle = swaggerHandler(async () => expected, load, report);
  expect(await handle(event('/swagger'))).toMatchObject({
    statusCode: 308,
    headers: { location: '/swagger/index.html' },
  });
  for (const asset of swaggerAssets) {
    expect(await handle(event(asset.route))).toMatchObject({
      statusCode: 401,
      headers: { 'www-authenticate': 'Basic realm="Swagger", charset="UTF-8"' },
    });
    expect(await handle(event(asset.route, authorization))).toMatchObject({
      statusCode: 200,
      body: 'asset',
      headers: {
        'content-type': asset.type,
        'cache-control': 'no-store',
        'x-frame-options': 'DENY',
      },
    });
  }
  expect(load).toHaveBeenCalledTimes(swaggerAssets.length);
  expect(await handle(event('/swagger/unknown', authorization))).toMatchObject({ statusCode: 404 });
  expect(await handle(event('/swagger/index.html', authorization, 'POST'))).toMatchObject({
    statusCode: 404,
  });
  expect(report).not.toHaveBeenCalled();
});

test('returns 503 without revealing credential or asset failures', async () => {
  const report = jest.fn();
  const unavailable = swaggerHandler(
    async () => {
      throw new Error('private secret');
    },
    async () => 'asset',
    report,
  );
  expect(await unavailable(event())).toMatchObject({
    statusCode: 503,
    body: 'Documentation temporarily unavailable',
  });
  const missingAsset = swaggerHandler(
    async () => expected,
    async () => {
      throw new Error('private file');
    },
    report,
  );
  expect(await missingAsset(event('/swagger/index.html', authorization))).toMatchObject({
    statusCode: 503,
    body: 'Documentation temporarily unavailable',
  });
  expect(report).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenLastCalledWith(
    expect.objectContaining({ errorName: 'Error', operation: 'Swagger' }),
  );
  expect(JSON.stringify(report.mock.calls)).not.toContain('private');
});

test('renews the secret after one minute and rejects stale credentials on refresh failure', async () => {
  jest.useFakeTimers();
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const aws = mockClient(client);
  try {
    aws.on(GetSecretValueCommand).resolves({ SecretString: JSON.stringify(expected) });
    const get = secretCredentials(client, 'swagger-secret');
    expect(await get()).toEqual(expected);
    jest.advanceTimersByTime(59_999);
    expect(await get()).toEqual(expected);
    expect(aws.commandCalls(GetSecretValueCommand)).toHaveLength(1);

    jest.advanceTimersByTime(1);
    aws.on(GetSecretValueCommand).rejects(new Error('unavailable'));
    await expect(get()).rejects.toThrow('unavailable');

    const rotated = { ...expected, password: randomBytes(24).toString('hex') };
    aws.on(GetSecretValueCommand).resolves({ SecretString: JSON.stringify(rotated) });
    expect(await get()).toEqual(rotated);
    expect(authorized(authorization, rotated)).toBe(false);
    expect(authorized(basic(`admin:${rotated.password}`), rotated)).toBe(true);
  } finally {
    aws.restore();
    client.destroy();
  }
});
