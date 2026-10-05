import { expect, jest, test } from '@jest/globals';
import type { Event } from '@domain/appointments/index';
import { batch } from '@infrastructure/sqs/batch';
import { event as schema } from '@infrastructure/messaging/dto/event.dto';
import { event, sqs } from '../../../support/fixtures.ts';
import type { ErrorDetails } from '@infrastructure/shared/error';

test('returns only failed SQS message IDs and continues with later records', async () => {
  const action = jest
    .fn<(message: Event) => Promise<void>>()
    .mockRejectedValueOnce('unavailable')
    .mockResolvedValue(undefined);
  const report = jest.fn<(details: ErrorDetails) => void>();

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
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ messageId: 'message-0', errorName: 'SyntaxError' }),
  );
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({ messageId: 'message-1', errorName: 'ZodError' }),
  );
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({
      messageId: 'message-2',
      errorName: 'UnknownError',
      appointmentId: event.appointmentId,
      correlationId: event.correlationId,
    }),
  );
  expect(report.mock.calls[0]?.[0]).not.toHaveProperty('appointmentId');
  expect(await batch(sqs(), (body) => schema.parse(body), action, report)).toEqual({
    batchItemFailures: [],
  });
});
