import { expect, test } from '@jest/globals';
import { openapi } from '@infrastructure/http/swagger/openapi';
import { parseJsonBody } from '@infrastructure/http/helpers/body';
import { http } from '../../../../support/fixtures.ts';

test('documents the media type and the exact unsupported-media response', () => {
  const post = openapi().paths['/appointments'].post;
  expect(post.requestBody.required).toBe(true);
  expect(Object.keys(post.requestBody.content)).toEqual(['application/json']);
  expect(post.requestBody.description).toContain('Content-Type: application/json');
  const parsed = parseJsonBody({ ...http('POST /appointments', '{}'), headers: {} });
  expect(parsed.success).toBe(false);
  if (parsed.success) {
    throw new Error('Expected unsupported media type');
  }
  expect(parsed.response).toMatchObject({
    statusCode: 415,
    body: JSON.stringify(post.responses['415'].content['application/json'].example),
  });
});
