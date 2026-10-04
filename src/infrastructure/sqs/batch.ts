import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';

export async function batch<T>(
  input: SQSEvent,
  parse: (body: unknown) => T,
  action: (event: T) => Promise<void>,
  report: (messageId: string, errorName: string) => void,
): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of input.Records) {
    try {
      await action(parse(JSON.parse(record.body)));
    } catch (error) {
      report(record.messageId, error instanceof Error ? error.name : 'UnknownError');
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
