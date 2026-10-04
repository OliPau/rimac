import { expect, jest, test } from '@jest/globals';
import type { Event } from '@domain/appointments/index';
import { batch } from '@infrastructure/sqs/batch';
import { event as schema } from '@infrastructure/messaging/dto/event.dto';
import { event, sqs } from '../../../support/fixtures.ts';

test('returns only failed SQS message IDs and continues with later records', async () => {
  const action = jest
    .fn<(message: Event) => Promise<void>>()
    .mockRejectedValueOnce('unavailable')
    .mockResolvedValue(undefined);
  const report = jest.fn<(messageId: string, errorName: string) => void>();

  expect(
    await batch(sqs('{', {}, event, event), (body) => schema.parse(body), action, report),
  ).toEqual({
    batchItemFailures: [
      { itemIdentifier: 'message-0' },
      { itemIdentifier: 'message-1' },
      { itemIdentifier: 'message-2' },
    ],
  });
  expect(action).toHaveBeenCalledTimes(2);
  expect(report).toHaveBeenCalledWith('message-0', 'SyntaxError');
  expect(report).toHaveBeenCalledWith('message-1', 'ZodError');
  expect(report).toHaveBeenCalledWith('message-2', 'UnknownError');
  expect(await batch(sqs(), (body) => schema.parse(body), action, report)).toEqual({
    batchItemFailures: [],
  });
});
