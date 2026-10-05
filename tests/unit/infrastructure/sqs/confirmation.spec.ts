import { expect, jest, test } from '@jest/globals';
import { Logger } from '@aws-lambda-powertools/logger';
import { confirmationHandler } from '@infrastructure/sqs/confirmation';
import type { ConfirmAppointment } from '@application/appointments/use-cases/confirm';
import { event, sqs } from '../../../support/fixtures.ts';

test('reports invalid and failed confirmations without blocking the next record', async () => {
  const execute = jest
    .fn<ConfirmAppointment['execute']>()
    .mockRejectedValueOnce(new Error('Dynamo unavailable'))
    .mockResolvedValue(undefined);
  const logger = new Logger({ serviceName: 'test' });
  const info = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  const completed = { ...event, type: 'appointment.completed' };

  expect(await confirmationHandler({ execute }, logger)(sqs(event, completed, completed))).toEqual({
    batchItemFailures: [{ itemIdentifier: 'message-0' }, { itemIdentifier: 'message-1' }],
  });
  expect(execute).toHaveBeenCalledTimes(2);
  expect(info).toHaveBeenCalledWith('AppointmentCompleted', {
    appointmentId: event.appointmentId,
    correlationId: event.correlationId,
  });
  expect(error).toHaveBeenCalledWith(
    'ConfirmationFailed',
    expect.objectContaining({
      messageId: 'message-1',
      errorName: 'Error',
      appointmentId: event.appointmentId,
      correlationId: event.correlationId,
    }),
  );
});
