import type { APIGatewayProxyEventV2, SQSEvent } from 'aws-lambda';
import { handleConfirmation, handleHttp } from '../composition/appointment.ts';

export const handler = (event: APIGatewayProxyEventV2 | SQSEvent) =>
  'Records' in event ? handleConfirmation(event) : handleHttp(event);
