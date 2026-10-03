import { afterEach, expect, jest, test } from '@jest/globals';

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'SwaggerUIBundle');
  Reflect.deleteProperty(globalThis, 'location');
});

test('does not send documentation credentials with appointment requests', async () => {
  const bundle = jest.fn();
  Object.defineProperty(globalThis, 'SwaggerUIBundle', { value: bundle, configurable: true });
  Object.defineProperty(globalThis, 'location', {
    value: { href: 'https://example.com/swagger/', origin: 'https://example.com' },
    configurable: true,
  });

  const { requestInterceptor } = await import('@infrastructure/http/swagger/initializer');
  expect(bundle).toHaveBeenCalledWith(
    expect.objectContaining({
      supportedSubmitMethods: ['get', 'post'],
      requestInterceptor,
      validatorUrl: null,
    }),
  );
  for (const [url, credentials] of [
    ['/swagger/openapi.json', 'same-origin'],
    ['/appointments', 'omit'],
    ['https://other.example/swagger/openapi.json', 'omit'],
  ] as const) {
    const request = requestInterceptor({
      url,
      headers: { Authorization: 'private', authorization: 'private', Accept: 'application/json' },
    });
    expect(request.headers).toEqual({ Accept: 'application/json' });
    expect(request.credentials).toBe(credentials);
  }
});
