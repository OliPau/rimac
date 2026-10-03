import type { Acceptance } from '../dto/create.dto.ts';

export function accept(
  appointmentId: string,
  createdAt: string,
  status: Acceptance['status'] = 'pending',
): Acceptance {
  return {
    appointmentId,
    status,
    createdAt,
    message:
      status === 'completed'
        ? 'El agendamiento ya fue confirmado.'
        : 'El agendamiento está en proceso.',
  };
}
