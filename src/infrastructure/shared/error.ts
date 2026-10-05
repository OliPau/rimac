const safeMessages = new Set([
  'Unexpected appointment country',
  'Unexpected confirmation type',
  'Conflicting country appointment',
  'Concurrent appointment could not be read',
  'EventBridge rejected confirmation',
  'Missing EventBridge receipt',
  'MySQL secret targets a different country',
  'MySQL secret has no value',
  'InvalidSwaggerSecret',
]);

interface ErrorContext {
  operation?: string;
  requestId?: string;
  messageId?: string;
  appointmentId?: string;
  correlationId?: string;
}

function identifier(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(value)
    ? value
    : undefined;
}

export function errorDetails(error: unknown, context: ErrorContext = {}) {
  const failure = error instanceof Error ? error : undefined;
  const errorName = identifier(failure?.name) ?? 'UnknownError';
  // Dependency messages can contain SQL, credentials or invalid input.
  const errorMessage =
    failure && safeMessages.has(failure.message) ? failure.message : 'Internal operation failed';
  const errorCode = identifier(failure && 'code' in failure ? failure.code : undefined);
  // Keep source locations, without the message or arbitrary object properties.
  const errorStack = failure?.stack
    ?.split('\n')
    .filter((line) => /^\s+at /.test(line))
    .map((line) => /([\w.-]+\.(?:[cm]?js|ts):\d+:\d+)\)?$/.exec(line)?.[1])
    .filter((line): line is string => line !== undefined)
    .slice(0, 8);

  return { ...context, errorName, errorCode, errorMessage, errorStack };
}

export type ErrorDetails = ReturnType<typeof errorDetails>;
