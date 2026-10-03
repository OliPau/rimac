import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handleHttp } from '../composition/appointment.ts';

export const handler = (event: APIGatewayProxyEventV2) => handleHttp(event);
