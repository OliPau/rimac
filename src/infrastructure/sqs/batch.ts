import type { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { errorDetails, type ErrorDetails } from '@infrastructure/shared/error';

export async function batch<T extends { appointmentId: string; correlationId: string }>(
  input: SQSEvent,
  parse: (body: unknown) => T,
  action: (event: T) => Promise<void>,
  report: (details: ErrorDetails) => void,
): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of input.Records) {
    let parsed: T | undefined;
    try {
      parsed = parse(JSON.parse(record.body));
      await action(parsed);
    } catch (error) {
      report(
        errorDetails(error, {
          messageId: record.messageId,
          ...(parsed
            ? { appointmentId: parsed.appointmentId, correlationId: parsed.correlationId }
            : {}),
        }),
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
