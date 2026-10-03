import { expect, jest, test } from '@jest/globals';
import type { CountryStore } from '@application/appointments/ports/repositories';
import { ProcessAppointment } from '@application/appointments/use-cases/process';
import { event } from '../../../../support/fixtures.ts';

test('saves PE and CL through the same use case and rejects the wrong country', async () => {
  const save = jest.fn<CountryStore['save']>().mockResolvedValue(undefined);
  const pe = new ProcessAppointment('PE', { save });
  const cl = new ProcessAppointment('CL', { save });
  const clEvent = { ...event, countryISO: 'CL' as const };

  await pe.execute(event);
  await cl.execute(clEvent);
  expect(save).toHaveBeenCalledTimes(2);
  await expect(pe.execute(clEvent)).rejects.toThrow('Unexpected appointment country');
  expect(save).toHaveBeenCalledTimes(2);

  save.mockRejectedValueOnce(new Error('MySQL unavailable'));
  await expect(pe.execute(event)).rejects.toThrow('MySQL unavailable');
});
