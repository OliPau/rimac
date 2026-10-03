import { expect, test } from '@jest/globals';
import { identity } from '@domain/appointments/index';
test('keeps one identifier for a business request and separates different requests', () => {
  const input = { insuredId: '00123', scheduleId: 100, countryISO: 'PE' as const };
  expect(identity(input)).toEqual(identity({ ...input }));
  expect(identity(input).appointmentId).not.toEqual(
    identity({ ...input, countryISO: 'CL' }).appointmentId,
  );
  expect(identity(input).appointmentId).not.toEqual(
    identity({ ...input, scheduleId: 101 }).appointmentId,
  );
  expect(identity(input).appointmentId).not.toEqual(
    identity({ ...input, insuredId: '00124' }).appointmentId,
  );
});
