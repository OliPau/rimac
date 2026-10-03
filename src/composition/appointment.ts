import { CreateAppointment } from '@application/appointments/use-cases/create';
import { ListAppointments } from '@application/appointments/use-cases/list';
import { httpHandler } from '@infrastructure/http/handler';
import { appointments } from './dynamo.ts';
import { logger } from './config.ts';

export const handleHttp = httpHandler(
  new CreateAppointment(appointments),
  new ListAppointments(appointments),
  (errorName) => logger.error('RequestFailed', { errorName }),
);
