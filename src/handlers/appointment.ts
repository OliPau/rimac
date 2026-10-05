import type { APIGatewayProxyEventV2, Context, SQSEvent } from 'aws-lambda';
import { handleConfirmation, handleHttp } from '../composition/appointment.ts';
import { logger } from '../composition/config.ts';

export function handler(event: APIGatewayProxyEventV2 | SQSEvent, context?: Context) {
  if (context) {
    logger.addContext(context);
  }
  return 'Records' in event ? handleConfirmation(event) : handleHttp(event);
}
