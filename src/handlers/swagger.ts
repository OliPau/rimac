import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { handleSwagger } from '../composition/swagger.ts';
import { logger } from '../composition/config.ts';

export function handler(event: APIGatewayProxyEventV2, context: Context) {
  logger.addContext(context);
  return handleSwagger(event);
}
