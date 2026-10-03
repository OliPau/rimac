import { expect, jest, test } from '@jest/globals';
import { publicSwagger } from '@infrastructure/http/swagger/handler';
import { http } from '../../../../support/fixtures.ts';

test('redirects to the documentation and rejects unknown paths', async () => {
  const readAsset = jest.fn(async () => 'asset');
  expect(await publicSwagger({ ...http('GET /swagger'), rawPath: '/swagger' }, readAsset)).toEqual({
    statusCode: 308,
    headers: { location: '/swagger/index.html' },
  });
  expect(await publicSwagger({ ...http('GET /other'), rawPath: '/other' }, readAsset)).toEqual({
    statusCode: 404,
    body: 'Not found',
  });
  expect(readAsset).not.toHaveBeenCalled();
});

test('serves each documented asset with its content type', async () => {
  const readAsset = jest.fn(async (path: string, encoding: 'utf8') => `${path} (${encoding})`);
  const assets = [
    ['/swagger/index.html', 'static/swagger/index.html', 'text/html; charset=utf-8'],
    ['/swagger/swagger-ui.css', 'static/swagger/swagger-ui.css', 'text/css; charset=utf-8'],
    [
      '/swagger/swagger-ui-bundle.js',
      'static/swagger/swagger-ui-bundle.js',
      'text/javascript; charset=utf-8',
    ],
    ['/swagger/initializer.js', 'static/swagger/initializer.js', 'text/javascript; charset=utf-8'],
    ['/swagger/openapi.json', 'static/swagger/openapi.json', 'application/json; charset=utf-8'],
  ] as const;
  for (const [route, file, type] of assets) {
    expect(await publicSwagger({ ...http('GET /swagger'), rawPath: route }, readAsset)).toEqual({
      statusCode: 200,
      headers: { 'content-type': type, 'cache-control': 'no-store' },
      body: `${file} (utf8)`,
    });
    expect(readAsset).toHaveBeenLastCalledWith(file, 'utf8');
  }
});
