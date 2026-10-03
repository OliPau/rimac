declare global {
  var SwaggerUIBundle: (options: Record<string, unknown>) => unknown;
}

export {};

globalThis.SwaggerUIBundle({
  url: '/swagger/openapi.json',
  dom_id: '#swagger-ui',
  layout: 'BaseLayout',
  validatorUrl: null,
  queryConfigEnabled: false,
  persistAuthorization: false,
  supportedSubmitMethods: [],
});
