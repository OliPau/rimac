import type { ZodError } from 'zod';

export function validationDetails(root: string, error: ZodError) {
  const details = error.issues.map((issue) => {
    const field = issue.path.map(String).join('.') || root;
    return [field, { field, message: issue.message }] as const;
  });
  return [...new Map(details).values()];
}
