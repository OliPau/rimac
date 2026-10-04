import type { SQSEvent } from 'aws-lambda';
import type { Logger } from '@aws-lambda-powertools/logger';
import type { Country } from '@domain/appointments/index';
import type { ProcessAppointment } from '@application/appointments/use-cases/process';
import { event as eventSchema } from '@infrastructure/messaging/dto/event.dto';
import { batch } from './batch.ts';

export function countryHandler(process: ProcessAppointment, country: Country, logger: Logger) {
  return (input: SQSEvent) =>
    batch(
      input,
      (body) => eventSchema.parse(body),
      async (event) => {
        await process.execute(event);
        logger.info('CountrySaved', {
          appointmentId: event.appointmentId,
          correlationId: event.correlationId,
          country,
        });
      },
      (messageId, errorName) => logger.error('CountryFailed', { messageId, errorName, country }),
    );
}
