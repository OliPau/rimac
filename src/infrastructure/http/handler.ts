import { parseJsonBody } from './helpers/body.ts';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { CreateAppointment } from '@application/appointments/use-cases/create';
import type { ListAppointments } from '@application/appointments/use-cases/list';

import { insured, request } from '@infrastructure/shared/appointment.schema';
import { validationDetails } from './helpers/validation.ts';
import { response } from './helpers/response.ts';
import { InvalidCursor } from '@infrastructure/persistence/dynamo/cursor';

export function httpHandler(
  create: CreateAppointment,
  list: ListAppointments,
  report: (name: string) => void,
) {
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

      if (event.routeKey === 'GET /appointments/{insuredId}') {
        const id = insured.safeParse(event.pathParameters?.insuredId);
        if (!id.success) {
          return response(400, {
            error: { code: 'INVALID_REQUEST', details: validationDetails('insuredId', id.error) },
          });
        }
        const query = event.queryStringParameters ?? {};
        const limit = query.limit;
        if (
          Object.keys(query).some((name) => name !== 'limit' && name !== 'cursor') ||
          (limit !== undefined && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit))
        ) {
          return response(400, {
            error: {
              code: 'INVALID_REQUEST',
              details: [
                { field: 'query', message: 'Use limit entre 1 y 100 y, si corresponde, cursor.' },
              ],
            },
          });
        }
        return response(
          200,
          await list.execute({
            insuredId: id.data,
            limit: limit === undefined ? 20 : Number(limit),
            ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          }),
        );
      }

      return response(404, { error: { code: 'NOT_FOUND' } });
    } catch (error) {
      if (error instanceof InvalidCursor) {
        return response(400, {
          error: {
            code: 'INVALID_CURSOR',
            details: [{ field: 'cursor', message: 'El cursor no es válido para este asegurado.' }],
          },
        });
      }
      report(error instanceof Error ? error.name : 'UnknownError');
      return response(503, { error: { code: 'SERVICE_UNAVAILABLE' } });
    }
  };
}
