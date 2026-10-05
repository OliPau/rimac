import { expect, test } from '@jest/globals';
import { errorDetails } from '@infrastructure/shared/error';

test('keeps diagnostics without dependency messages, SQL, credentials or causes', () => {
  const failure = Object.assign(new Error('password=private mysql://user:secret@host/db'), {
    code: 'ER_ACCESS_DENIED_ERROR',
    sql: 'SELECT private_data',
    cause: new Error('Authorization: Bearer private-token'),
    stack:
      'Error: private\n    at save (/var/task/repository.cjs:10:4)\n    at process (/var/task/worker.cjs:20:8)',
  });
  expect(errorDetails(failure, { requestId: 'request' })).toEqual({
    requestId: 'request',
    errorName: 'Error',
    errorCode: 'ER_ACCESS_DENIED_ERROR',
    errorMessage: 'Internal operation failed',
    errorStack: ['repository.cjs:10:4', 'worker.cjs:20:8'],
  });
});

test('preserves controlled application messages and bounds the stack', () => {
  const failure = new Error('Conflicting country appointment');
  failure.stack = Array.from(
    { length: 20 },
    () => '    at save (/var/task/repository.cjs:1:2)',
  ).join('\n');
  expect(errorDetails(failure)).toMatchObject({ errorMessage: failure.message });
  expect(errorDetails(failure).errorStack).toHaveLength(8);
});

test('does not serialize arbitrary thrown values or invalid identifiers', () => {
  expect(errorDetails({ password: 'secret' })).toEqual({
    errorName: 'UnknownError',
    errorCode: undefined,
    errorMessage: 'Internal operation failed',
    errorStack: undefined,
  });
  const failure = Object.assign(new Error('secret'), {
    name: 'Error\nsecret',
    code: 'token=secret',
  });
  expect(errorDetails(failure)).toMatchObject({ errorName: 'UnknownError', errorCode: undefined });
});
