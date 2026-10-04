import { z } from 'zod';
import { insured } from '@infrastructure/shared/appointment.schema';

const key = z.strictObject({
  insuredId: insured,
  appointmentId: z.uuid(),
  createdAt: z.iso.datetime(),
});

export class InvalidCursor extends Error {
  constructor() {
    super('Invalid pagination cursor');
  }
}

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(key.parse(value))).toString('base64url');
}

export function decodeCursor(cursor: string, insuredId: string) {
  try {
    if (!cursor || cursor.length > 2048) {
      throw new InvalidCursor();
    }
    const bytes = Buffer.from(cursor, 'base64url');
    if (bytes.toString('base64url') !== cursor) {
      throw new InvalidCursor();
    }
    const parsed: unknown = JSON.parse(bytes.toString('utf8'));
    const value = key.parse(parsed);
    if (value.insuredId !== insuredId) {
      throw new InvalidCursor();
    }
    return value;
  } catch {
    throw new InvalidCursor();
  }
}
