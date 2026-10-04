import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { unzipSync } from 'fflate';
import { inspectPackages } from './packages.ts';

const directory = '.local/artifacts';
await inspectPackages(directory);

const archive = unzipSync(await readFile(join(directory, 'appointment.zip')));
const bundledHandler = archive['src/handlers/appointment.cjs'];
if (!bundledHandler) {
  throw new Error('Appointment handler is missing from the ZIP');
}
const extractedPath = '.local/inspection/appointment.cjs';
await mkdir(dirname(extractedPath), { recursive: true });
await writeFile(extractedPath, bundledHandler);
process.env.APPOINTMENTS_TABLE ??= 'package-inspection';
process.env.TOPIC_ARN ??= 'arn:aws:sns:us-east-1:123456789012:package-inspection';
const load = createRequire(import.meta.url);
const module = load(resolve(extractedPath)) as {
  handler?: (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;
};
if (typeof module.handler !== 'function') {
  throw new Error('Appointment ZIP does not export a Lambda handler');
}
const event: APIGatewayProxyEventV2 = {
  version: '2.0',
  routeKey: 'POST /appointments',
  rawPath: '/appointments',
  rawQueryString: '',
  headers: { 'content-type': 'application/json' },
  body: '{',
  isBase64Encoded: false,
  requestContext: {
    accountId: '123456789012',
    apiId: 'api',
    domainName: 'example.test',
    domainPrefix: 'api',
    requestId: 'package-inspection',
    routeKey: 'POST /appointments',
    stage: 'local',
    time: '',
    timeEpoch: 0,
    http: {
      method: 'POST',
      path: '/appointments',
      protocol: 'HTTP/1.1',
      sourceIp: '127.0.0.1',
      userAgent: 'package-inspection',
    },
  },
};
const result = await module.handler(event);
if (typeof result !== 'object' || result.statusCode !== 400) {
  throw new Error('The packaged Lambda did not handle the request');
}
console.log('Packaged appointment handler loads and responds');

const swaggerArchive = unzipSync(await readFile(join(directory, 'swagger.zip')));
const decode = (path: string) => new TextDecoder().decode(swaggerArchive[path]);
const page = decode('static/swagger/index.html');
for (const path of [
  '/swagger/swagger-ui.css',
  '/swagger/swagger-ui-bundle.js',
  '/swagger/initializer.js',
]) {
  if (!page.includes(path)) {
    throw new Error(`Swagger page does not reference ${path}`);
  }
}
const stylesheet = decode('static/swagger/swagger-ui.css');
const urls = [...stylesheet.matchAll(/url\(([^)]+)\)/g)];
if (
  urls.some(
    (match) =>
      !match[1]
        ?.trim()
        .replace(/^['"]|['"]$/g, '')
        .startsWith('data:'),
  )
) {
  throw new Error('Swagger stylesheet requires an external file');
}
console.log('Packaged Swagger contains the page and its local assets');

const workerArchive = unzipSync(await readFile(join(directory, 'worker.zip')));
const bundledWorker = workerArchive['src/handlers/worker.cjs'];
if (!bundledWorker) {
  throw new Error('Worker handler is missing from the ZIP');
}
const workerPath = '.local/inspection/worker.cjs';
await writeFile(workerPath, bundledWorker);
process.env.COUNTRY ??= 'PE';
process.env.SQL_SECRET_ARN ??=
  'arn:aws:secretsmanager:us-east-1:123456789012:secret:package-inspection';
process.env.EVENT_BUS ??= 'package-inspection';
const worker = load(resolve(workerPath)) as { handler?: unknown };
if (typeof worker.handler !== 'function') {
  throw new Error('Worker ZIP does not export a Lambda handler');
}
console.log('Packaged worker handler loads');
