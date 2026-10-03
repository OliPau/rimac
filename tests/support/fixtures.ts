import type { APIGatewayProxyEventV2 } from 'aws-lambda';
export function http(routeKey: string, body?: string): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey,
    rawPath: '/appointments',
    rawQueryString: '',
    headers: routeKey === 'POST /appointments' ? { 'content-type': 'application/json' } : {},
    isBase64Encoded: false,
    ...(body === undefined ? {} : { body }),
    requestContext: {
      accountId: '123456789012',
      apiId: 'api',
      domainName: 'example.test',
      domainPrefix: 'api',
      requestId: 'request',
      routeKey,
      stage: 'demo',
      time: '',
      timeEpoch: 0,
      http: {
        method: 'POST',
        path: '/appointments',
        protocol: 'HTTP/1.1',
        sourceIp: '',
        userAgent: '',
      },
    },
  };
}
