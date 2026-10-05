import { Logger } from '@aws-lambda-powertools/logger';
import { expect, jest, test } from '@jest/globals';
import type { ConfirmationPublisher } from '@application/appointments/ports/messaging';
import type { CountryStore } from '@application/appointments/ports/repositories';
import { ProcessAppointment } from '@application/appointments/use-cases/process';
import { countryHandler } from '@infrastructure/sqs/country';
import { event, sqs } from '../../../support/fixtures.ts';

test('reports the failed country record while acknowledging the saved record', async () => {
  const logger = new Logger({ serviceName: 'test' });
  const info = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  const save = jest.fn<CountryStore['save']>().mockResolvedValue(undefined);
  const publish = jest.fn<ConfirmationPublisher['publish']>().mockResolvedValue(undefined);
  const handle = countryHandler(new ProcessAppointment('PE', { save }, { publish }), 'PE', logger);

  expect(await handle(sqs(event, { ...event, countryISO: 'CL' }))).toEqual({
    batchItemFailures: [{ itemIdentifier: 'message-1' }],
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledTimes(1);
  expect(info).toHaveBeenCalledWith('CountrySaved', {
    appointmentId: event.appointmentId,
    correlationId: event.correlationId,
    country: 'PE',
  });
  expect(error).toHaveBeenCalledWith(
    'CountryFailed',
    expect.objectContaining({
      messageId: 'message-1',
      errorName: 'Error',
      country: 'PE',
      appointmentId: event.appointmentId,
      correlationId: event.correlationId,
      errorMessage: 'Unexpected appointment country',
    }),
  );
});

test('retries a saved message if confirmation publishing fails', async () => {
  const logger = new Logger({ serviceName: 'test' });
  jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  const save = jest.fn<CountryStore['save']>().mockResolvedValue(undefined);
  const publish = jest
    .fn<ConfirmationPublisher['publish']>()
    .mockRejectedValue(new Error('EventBridge unavailable'));
  const handle = countryHandler(new ProcessAppointment('PE', { save }, { publish }), 'PE', logger);

  expect(await handle(sqs(event))).toEqual({
    batchItemFailures: [{ itemIdentifier: 'message-0' }],
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledTimes(1);
});
