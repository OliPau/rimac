import { z } from 'zod';
import {
  request,
  acceptance,
  appointment,
  insured,
} from '@infrastructure/shared/appointment.schema';
export function openapi(server = '/') {
  return {
    openapi: '3.1.0',
    info: {
      title: 'RIMAC Learning',
      version: '1.0.0',
      description: 'API de aprendizaje para citas. Utilizar únicamente datos ficticios.',
    },
    servers: [{ url: server }],
    paths: {
      '/appointments': {
        post: {
          summary: 'Registrar una cita',
          description:
            'La misma reserva conserva identificador y fecha. Un reintento confirmado devuelve 200; uno pendiente devuelve 202. scheduleId referencia un horario externo, sin consultar disponibilidad.',
          requestBody: {
            description:
              'Enviar Content-Type: application/json. Se admite charset=utf-8. Máximo 4096 bytes UTF-8; los campos se validan con Zod.',
            required: true,
            content: {
              'application/json': {
                schema: z.toJSONSchema(request),
                example: { insuredId: '00123', scheduleId: 100, countryISO: 'PE' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Ya confirmado',
              content: {
                'application/json': {
                  schema: z.toJSONSchema(acceptance.extend({ status: z.literal('completed') })),
                  example: {
                    appointmentId: 'd0e7d12c-8204-4557-8827-0ffb8a49384a',
                    status: 'completed',
                    message: 'El agendamiento ya fue confirmado.',
                    createdAt: '2026-01-15T10:30:00.000Z',
                  },
                },
              },
            },
            '202': {
              description: 'Pendiente',
              content: {
                'application/json': {
                  schema: z.toJSONSchema(acceptance.extend({ status: z.literal('pending') })),
                  example: {
                    appointmentId: 'd0e7d12c-8204-4557-8827-0ffb8a49384a',
                    status: 'pending',
                    message: 'El agendamiento está en proceso.',
                    createdAt: '2026-01-15T10:30:00.000Z',
                  },
                },
              },
            },
            '400': { description: 'INVALID_JSON o INVALID_REQUEST; revisar los campos' },
            '415': {
              description:
                'Content-Type ausente o no admitido. Se requiere application/json; se permiten parámetros como charset=utf-8.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['error'],
                    properties: {
                      error: {
                        type: 'object',
                        required: ['code'],
                        properties: {
                          code: { type: 'string', enum: ['UNSUPPORTED_MEDIA_TYPE'] },
                        },
                      },
                    },
                  },
                  example: { error: { code: 'UNSUPPORTED_MEDIA_TYPE' } },
                },
              },
            },
            '413': { description: 'PAYLOAD_TOO_LARGE: más de 4096 bytes' },
            '503': {
              description:
                'SERVICE_UNAVAILABLE: la operación no está disponible temporalmente. error.requestId identifica la petición en los logs.',
            },
          },
        },
      },
      '/appointments/{insuredId}': {
        get: {
          summary: 'Consultar citas',
          description:
            'Devuelve las citas más recientes primero. El índice puede tardar brevemente en reflejar una cita recién registrada.',
          parameters: [
            {
              in: 'path',
              name: 'insuredId',
              required: true,
              schema: z.toJSONSchema(insured),
            },
            {
              in: 'query',
              name: 'limit',
              required: false,
              description: 'Cantidad de citas por página; por defecto 20.',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            },
            {
              in: 'query',
              name: 'cursor',
              required: false,
              description: 'Cursor recibido en la página anterior.',
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Página de citas, de más recientes a más antiguas',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['items'],
                    properties: {
                      items: { type: 'array', items: z.toJSONSchema(appointment) },
                      cursor: { type: 'string', description: 'Enviar en la siguiente consulta.' },
                    },
                  },
                  example: {
                    items: [
                      {
                        insuredId: '00123',
                        scheduleId: 100,
                        countryISO: 'PE',
                        appointmentId: 'd0e7d12c-8204-4557-8827-0ffb8a49384a',
                        status: 'pending',
                        createdAt: '2026-01-15T10:30:00.000Z',
                      },
                    ],
                  },
                },
              },
            },
            '400': { description: 'Asegurado, límite o cursor inválido' },
            '503': {
              description: 'No disponible. error.requestId identifica la petición en los logs.',
            },
          },
        },
      },
    },
  };
}
