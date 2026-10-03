import { z } from 'zod';
import { request } from '@infrastructure/shared/appointment.schema';

export const event = request.extend({
  version: z.literal(1),
  type: z.literal('appointment.requested'),
  eventId: z.uuid(),
  appointmentId: z.uuid(),
  correlationId: z.uuid(),
  occurredAt: z.iso.datetime(),
});

export const completion = event.omit({ type: true }).extend({
  type: z.literal('appointment.completed'),
});
