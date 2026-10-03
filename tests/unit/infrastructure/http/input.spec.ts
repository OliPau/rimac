import { expect, test } from '@jest/globals';
import { request } from '@infrastructure/shared/appointment.schema';
test.each([
  { insuredId: '00000200', scheduleId: 100, countryISO: 'PE' },
  { insuredId: '00200', scheduleId: '100', countryISO: 'PE' },
  { insuredId: '00200', scheduleId: 0, countryISO: 'PE' },
  { insuredId: '00200', scheduleId: Number.MAX_SAFE_INTEGER + 1, countryISO: 'PE' },
  { insuredId: '00200', scheduleId: 100, countryISO: 'pe' },
  { insuredId: '00200', scheduleId: 100, countryISO: 'PE', extra: true },
  null,
])('rejects invalid fields without coercion: %o', (input) => {
  expect(request.safeParse(input).success).toBe(false);
});
test('accepts five digits with leading zeroes', () => {
  expect(request.parse({ insuredId: '00200', scheduleId: 100, countryISO: 'CL' }).insuredId).toBe(
    '00200',
  );
});
