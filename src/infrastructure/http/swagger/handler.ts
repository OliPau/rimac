import { readFile } from 'node:fs/promises';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { swaggerAssets } from './assets.ts';
export async function publicSwagger(event: APIGatewayProxyEventV2) {
  if (event.rawPath === '/swagger') {
    return { statusCode: 308, headers: { location: '/swagger/index.html' } };
  }
  const asset = swaggerAssets.find((value) => value.route === event.rawPath);
  if (!asset) {
    return { statusCode: 404, body: 'Not found' };
  }
  return {
    statusCode: 200,
    headers: { 'content-type': asset.type, 'cache-control': 'no-store' },
    body: await readFile(asset.file, 'utf8'),
  };
}
