import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import type { Event } from '@domain/appointments/index';
import { event as schema } from '@infrastructure/messaging/dto/event.dto';

export async function batch(
  input: SQSEvent,
  action: (event: Event) => Promise<void>,
  report: (messageId: string, errorName: string) => void,
): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of input.Records) {
    try {
      await action(schema.parse(JSON.parse(record.body)));
    } catch (error) {
      report(record.messageId, error instanceof Error ? error.name : 'UnknownError');
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
