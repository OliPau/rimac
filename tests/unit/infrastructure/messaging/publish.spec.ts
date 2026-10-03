import { afterEach, expect, test } from '@jest/globals';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import { accept, requested } from '@application/appointments/helpers/registration';
import { identity } from '@domain/appointments/index';
import { SnsPublisher } from '@infrastructure/messaging/publish';

const client = new SNSClient({ region: 'us-east-1' });
const sns = mockClient(client);
const publisher = new SnsPublisher(client, 'arn:aws:sns:us-east-1:123456789012:appointments');

function appointmentEvent(countryISO: 'PE' | 'CL') {
  const input = { insuredId: '00123', scheduleId: 100, countryISO };
  const accepted = accept(identity(input).appointmentId, '2026-10-03T12:00:00.000Z');
  return requested(
    input,
    accepted,
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
  );
}

afterEach(() => {
  sns.reset();
});

test('publishes the appointment identity and country filter for PE and CL', async () => {
  sns.on(PublishCommand).resolves({ MessageId: 'published' });

  for (const country of ['PE', 'CL'] as const) {
    const event = appointmentEvent(country);
    await publisher.publish(event);
    const command = sns.commandCalls(PublishCommand).at(-1)?.args[0].input;
    expect(command).toMatchObject({
      TopicArn: 'arn:aws:sns:us-east-1:123456789012:appointments',
      MessageAttributes: { countryISO: { DataType: 'String', StringValue: country } },
    });
    expect(JSON.parse(command?.Message ?? '')).toEqual(event);
  }
  expect(sns.commandCalls(PublishCommand)).toHaveLength(2);
});

test('rejects invalid events before publishing and propagates SNS failures', async () => {
  const event = appointmentEvent('PE');
  await expect(publisher.publish({ ...event, eventId: 'invalid' })).rejects.toThrow();
  expect(sns.commandCalls(PublishCommand)).toHaveLength(0);

  sns.on(PublishCommand).rejects(new Error('SNS unavailable'));
  await expect(publisher.publish(event)).rejects.toThrow('SNS unavailable');
  expect(sns.commandCalls(PublishCommand)).toHaveLength(1);
});
