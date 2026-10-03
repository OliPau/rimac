import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { handleSwagger } from '../composition/swagger.ts';
export const handler = (event: APIGatewayProxyEventV2) => handleSwagger(event);
