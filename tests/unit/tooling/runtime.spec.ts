import { expect, test } from '@jest/globals';
test('uses the documented Node runtime', () => {
  expect(process.versions.node.split('.')[0]).toBe('24');
});
