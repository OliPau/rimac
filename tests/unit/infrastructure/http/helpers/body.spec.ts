import { expect, test } from '@jest/globals';
import { parseJsonBody } from '@infrastructure/http/helpers/body';
import { http } from '../../../../support/fixtures.ts';

test.each([
  { 'content-type': 'application/json' },
  { 'content-type': 'application/json; charset=utf-8' },
  { 'Content-Type': 'APPLICATION/JSON' },
  { 'content-type': ' application/json ; charset=UTF-8 ' },
])('accepts the exact JSON media type with optional parameters: %o', (headers) => {
  expect(
    parseJsonBody({ ...http('POST /appointments', '{"insuredId":"00123"}'), headers }),
  ).toEqual({
    success: true,
    body: { insuredId: '00123' },
  });
});

test.each([
  {},
  { 'content-type': undefined },
  { 'content-type': '' },
  { 'content-type': 'image/jpeg' },
  { 'content-type': 'application/jsonp' },
  { 'content-type': 'application/json-invalid' },
  { 'content-type': 'text/plain' },
  { 'content-type': 'application/json, text/plain' },
])('rejects missing or unsupported media types before reading the body: %o', (headers) => {
  const parsed = parseJsonBody({
    ...http('POST /appointments', 'invalid'.repeat(1000)),
    headers,
    isBase64Encoded: true,
  });
  expect(parsed).toMatchObject({
    success: false,
    response: {
      statusCode: 415,
      body: JSON.stringify({ error: { code: 'UNSUPPORTED_MEDIA_TYPE' } }),
    },
  });
});

test('accepts exactly 4096 UTF-8 bytes and rejects a larger body', () => {
  const body = '"' + 'a'.repeat(4094) + '"';
  expect(Buffer.byteLength(body, 'utf8')).toBe(4096);
  expect(parseJsonBody(http('POST /appointments', body))).toEqual({
    success: true,
    body: 'a'.repeat(4094),
  });
  const parsed = parseJsonBody(http('POST /appointments', body + ' '));
  expect(parsed).toMatchObject({
    success: false,
    response: {
      statusCode: 413,
      body: JSON.stringify({ error: { code: 'PAYLOAD_TOO_LARGE' } }),
    },
  });
});

test('counts UTF-8 bytes rather than JavaScript characters', () => {
  const body = JSON.stringify('é'.repeat(2048));
  expect(body.length).toBeLessThan(4096);
  expect(Buffer.byteLength(body, 'utf8')).toBeGreaterThan(4096);
  expect(parseJsonBody(http('POST /appointments', body))).toMatchObject({
    success: false,
    response: { statusCode: 413 },
  });
});

test('decodes the transport before parsing JSON and checking its size', () => {
  const body = JSON.stringify({ name: 'José' });
  expect(
    parseJsonBody({
      ...http('POST /appointments', Buffer.from(body).toString('base64')),
      isBase64Encoded: true,
    }),
  ).toEqual({
    success: true,
    body: { name: 'José' },
  });
  const atLimit = JSON.stringify('a'.repeat(4094));
  expect(
    parseJsonBody({
      ...http('POST /appointments', Buffer.from(atLimit).toString('base64')),
      isBase64Encoded: true,
    }),
  ).toMatchObject({ success: true });
  expect(
    parseJsonBody({
      ...http('POST /appointments', Buffer.from(atLimit + ' ').toString('base64')),
      isBase64Encoded: true,
    }),
  ).toMatchObject({
    success: false,
    response: { statusCode: 413 },
  });
});

test.each(['', '{', 'undefined'])(
  'reports malformed JSON without exposing its content: %s',
  (body) => {
    expect(parseJsonBody(http('POST /appointments', body))).toMatchObject({
      success: false,
      response: {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            code: 'INVALID_JSON',
            details: [{ field: 'body', message: 'Debe contener un documento JSON válido.' }],
          },
        }),
      },
    });
  },
);

test.each([false, true])('handles an absent body with base64 flag %s', (isBase64Encoded) => {
  expect(parseJsonBody({ ...http('POST /appointments'), isBase64Encoded })).toMatchObject({
    success: false,
    response: { statusCode: 400 },
  });
});

test.each([null, [], 12, { scheduleId: '100' }])(
  'leaves structural validation to Zod: %j',
  (body) => {
    expect(parseJsonBody(http('POST /appointments', JSON.stringify(body)))).toEqual({
      success: true,
      body,
    });
  },
);
