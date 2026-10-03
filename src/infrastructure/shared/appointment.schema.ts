import { z } from 'zod';

const insuredMessage = 'Debe ser un texto de exactamente 5 dígitos; puede incluir ceros iniciales.';
const scheduleMessage = `Debe ser un número entero entre 1 y ${Number.MAX_SAFE_INTEGER}.`;
const countryMessage = 'Debe ser PE o CL, en mayúsculas.';

export const insured = z
  .string({ error: insuredMessage })
  .regex(/^\d{5}$/, insuredMessage)
  .describe('Código del asegurado de cinco dígitos (por ejemplo, 00200).');
export const request = z.strictObject(
  {
    insuredId: insured,
    scheduleId: z
      .number({ error: scheduleMessage })
      .int(scheduleMessage)
      .positive(scheduleMessage)
      .max(Number.MAX_SAFE_INTEGER, scheduleMessage)
      .describe('Identificador del horario seleccionado.'),
    countryISO: z
      .enum(['PE', 'CL'], { error: countryMessage })
      .describe('País de atención (PE o CL).'),
  },
  { error: 'Debe ser un objeto JSON con únicamente insuredId, scheduleId y countryISO.' },
);
