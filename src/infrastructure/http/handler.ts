import { parseJsonBody } from './helpers/body.ts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { CreateAppointment } from '@application/appointments/use-cases/create';

import { request } from '@infrastructure/shared/appointment.schema';
import { validationDetails } from './helpers/validation.ts';
import { response } from './helpers/response.ts';

export function httpHandler(create: CreateAppointment, report: (name: string) => void) {
  return async (event: APIGatewayProxyEventV2) => {
    try {
      if (event.routeKey === 'POST /appointments') {
        const parsed = parseJsonBody(event);
        if (!parsed.success) {
          return parsed.response;
        }
        const input = request.safeParse(parsed.body);
        if (!input.success) {
          return response(400, {
            error: { code: 'INVALID_REQUEST', details: validationDetails('body', input.error) },
          });
        }
        const result = await create.execute(input.data);
        return response(result.status === 'completed' ? 200 : 202, result);
      }

      return response(404, { error: { code: 'NOT_FOUND' } });
    } catch (error) {
      report(error instanceof Error ? error.name : 'UnknownError');
      return response(503, { error: { code: 'SERVICE_UNAVAILABLE' } });
    }
  };
}
