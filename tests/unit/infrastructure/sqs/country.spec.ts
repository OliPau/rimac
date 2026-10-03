import { Logger } from '@aws-lambda-powertools/logger';
import { expect, jest, test } from '@jest/globals';
import type { CountryStore } from '@application/appointments/ports/repositories';
import { ProcessAppointment } from '@application/appointments/use-cases/process';
import { countryHandler } from '@infrastructure/sqs/country';
import { event, sqs } from '../../../support/fixtures.ts';

test('reports the failed country record while acknowledging the saved record', async () => {
  const logger = new Logger({ serviceName: 'test' });
  const info = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  const save = jest.fn<CountryStore['save']>().mockResolvedValue(undefined);
  const handle = countryHandler(new ProcessAppointment('PE', { save }), 'PE', logger);

  expect(await handle(sqs(event, { ...event, countryISO: 'CL' }))).toEqual({
    batchItemFailures: [{ itemIdentifier: 'message-1' }],
  });
  expect(save).toHaveBeenCalledTimes(1);
  expect(info).toHaveBeenCalledWith('CountrySaved', {
    appointmentId: event.appointmentId,
    correlationId: event.correlationId,
    country: 'PE',
  });
  expect(error).toHaveBeenCalledWith('CountryFailed', {
    messageId: 'message-1',
    errorName: 'Error',
    country: 'PE',
  });
});
