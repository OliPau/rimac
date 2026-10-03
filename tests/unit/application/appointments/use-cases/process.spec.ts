import { expect, jest, test } from '@jest/globals';
import type { ConfirmationPublisher } from '@application/appointments/ports/messaging';
import type { CountryStore } from '@application/appointments/ports/repositories';
import { ProcessAppointment } from '@application/appointments/use-cases/process';
import { event } from '../../../../support/fixtures.ts';

test('saves PE and CL through the same use case and rejects the wrong country', async () => {
  const order: string[] = [];
  const save = jest.fn<CountryStore['save']>().mockResolvedValue(undefined);
  const publish = jest.fn<ConfirmationPublisher['publish']>().mockResolvedValue(undefined);
  save.mockImplementation(async () => {
    order.push('save');
  });
  publish.mockImplementation(async () => {
    order.push('publish');
  });
  const pe = new ProcessAppointment('PE', { save }, { publish });
  const cl = new ProcessAppointment('CL', { save }, { publish });
  const clEvent = { ...event, countryISO: 'CL' as const };

  await pe.execute(event);
  await cl.execute(clEvent);
  expect(save).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenCalledWith({ ...event, type: 'appointment.completed' });
  expect(publish).toHaveBeenCalledWith({ ...clEvent, type: 'appointment.completed' });
  expect(order).toEqual(['save', 'publish', 'save', 'publish']);
  await expect(pe.execute(clEvent)).rejects.toThrow('Unexpected appointment country');
  expect(save).toHaveBeenCalledTimes(2);
  expect(publish).toHaveBeenCalledTimes(2);

  save.mockRejectedValueOnce(new Error('MySQL unavailable'));
  await expect(pe.execute(event)).rejects.toThrow('MySQL unavailable');
  expect(publish).toHaveBeenCalledTimes(2);

  publish.mockRejectedValueOnce(new Error('EventBridge unavailable'));
  await expect(pe.execute(event)).rejects.toThrow('EventBridge unavailable');
  expect(save).toHaveBeenCalledTimes(4);
});
