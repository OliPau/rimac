import type { Context, SQSEvent } from 'aws-lambda';
import { handleCountry } from '../composition/worker.ts';
import { logger } from '../composition/config.ts';

export function handler(event: SQSEvent, context: Context) {
  logger.addContext(context);
  return handleCountry(event);
}
