import { CreateAppointment } from '@application/appointments/use-cases/create';
import { ConfirmAppointment } from '@application/appointments/use-cases/confirm';
import { ListAppointments } from '@application/appointments/use-cases/list';
import { httpHandler } from '@infrastructure/http/handler';
import { confirmationHandler } from '@infrastructure/sqs/confirmation';
import { appointments } from './dynamo.ts';
import { publisher } from './messaging.ts';
import { logger } from './config.ts';

export const handleHttp = httpHandler(
  new CreateAppointment(appointments, publisher),
  new ListAppointments(appointments),
  (errorName) => logger.error('RequestFailed', { errorName }),
);

export const handleConfirmation = confirmationHandler(new ConfirmAppointment(appointments), logger);
