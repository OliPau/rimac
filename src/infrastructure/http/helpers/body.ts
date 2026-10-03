import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { response } from './response.ts';

const maximumBodyBytes = 4 * 1024;
type ParsedBody =
  { success: true; body: unknown } | { success: false; response: ReturnType<typeof response> };

export function parseJsonBody(event: APIGatewayProxyEventV2): ParsedBody {
  const contentType =
    Object.entries(event.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1] ??
    '';
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return {
      success: false,
      response: response(415, { error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }),
    };
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
    : (event.body ?? '');
  if (Buffer.byteLength(raw, 'utf8') > maximumBodyBytes) {
    return {
      success: false,
      response: response(413, { error: { code: 'PAYLOAD_TOO_LARGE' } }),
    };
  }
  try {
    const body: unknown = JSON.parse(raw);
    return { success: true, body };
  } catch {
    return {
      success: false,
      response: response(400, {
        error: {
          code: 'INVALID_JSON',
          details: [{ field: 'body', message: 'Debe contener un documento JSON válido.' }],
        },
      }),
    };
  }
}
