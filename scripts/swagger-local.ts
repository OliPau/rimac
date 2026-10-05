import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { openapi } from '@infrastructure/http/swagger/openapi';
import { errorDetails } from '@infrastructure/shared/error';
const require = createRequire(import.meta.url);
const directory = dirname(require.resolve('swagger-ui-dist/package.json'));
const routes: Record<string, { path: string; type: string }> = {
  '/swagger/swagger-ui.css': { path: join(directory, 'swagger-ui.css'), type: 'text/css' },
  '/swagger/swagger-ui-bundle.js': {
    path: join(directory, 'swagger-ui-bundle.js'),
    type: 'text/javascript',
  },
};
createServer((request, response) => {
  void (async () => {
    const url = request.url ?? '/';
    if (url === '/swagger' || url === '/swagger/') {
      response.writeHead(302, { location: '/swagger/index.html' }).end();
      return;
    }
    if (url === '/swagger/index.html') {
      response
        .writeHead(200, { 'content-type': 'text/html' })
        .end(await readFile('src/infrastructure/http/swagger/index.html'));
      return;
    }
    if (url === '/swagger/openapi.json') {
      response
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify(openapi(process.env.API_URL ?? '/')));
      return;
    }
    if (url === '/swagger/initializer.js') {
      response
        .writeHead(200, { 'content-type': 'text/javascript' })
        .end(
          'window.onload = () => SwaggerUIBundle({ url: "./openapi.json", dom_id: "#swagger-ui", validatorUrl: null, supportedSubmitMethods: [] });',
        );
      return;
    }
    const asset = routes[url];
    if (!asset) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': asset.type }).end(await readFile(asset.path));
  })().catch((error: unknown) => {
    console.error('LocalSwaggerFailed', errorDetails(error));
    response.writeHead(500).end('Local documentation unavailable');
  });
}).listen(8080, '127.0.0.1', () => console.log('http://127.0.0.1:8080/swagger'));
