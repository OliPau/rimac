import { expect, test } from '@jest/globals';
import { accept, requested } from '@application/appointments/helpers/registration';
import { identity } from '@domain/appointments/index';

test('creates a request event from the accepted appointment', () => {
  const input = { insuredId: '00123', scheduleId: 100, countryISO: 'PE' as const };
  const accepted = accept(identity(input).appointmentId, '2026-10-03T12:00:00.000Z');

  expect(requested(input, accepted, 'event-id', 'correlation-id')).toEqual({
    ...input,
    version: 1,
    type: 'appointment.requested',
    eventId: 'event-id',
    appointmentId: accepted.appointmentId,
    correlationId: 'correlation-id',
    occurredAt: accepted.createdAt,
  });
});
