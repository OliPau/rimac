import type { SQSEvent } from 'aws-lambda';
import type { Logger } from '@aws-lambda-powertools/logger';
import type { ConfirmAppointment } from '@application/appointments/use-cases/confirm';
import { completion } from '@infrastructure/messaging/dto/event.dto';
import { batch } from './batch.ts';

export function confirmationHandler(confirm: Pick<ConfirmAppointment, 'execute'>, logger: Logger) {
  return (input: SQSEvent) =>
    batch(
      input,
      (body) => completion.parse(body),
      async (event) => {
        await confirm.execute(event);
        logger.info('AppointmentCompleted', {
          appointmentId: event.appointmentId,
          correlationId: event.correlationId,
        });
      },
      (messageId, errorName) => logger.error('ConfirmationFailed', { messageId, errorName }),
    );
}
