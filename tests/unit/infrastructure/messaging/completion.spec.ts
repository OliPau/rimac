import { afterAll, afterEach, expect, test } from '@jest/globals';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { mockClient } from 'aws-sdk-client-mock';
import { CompletionPublisher } from '@infrastructure/messaging/publish';
import { event } from '../../../support/fixtures.ts';

const client = new EventBridgeClient({ region: 'us-east-1' });
const eventBridge = mockClient(client);
const publisher = new CompletionPublisher(client, 'appointment-bus');
const completion = { ...event, type: 'appointment.completed' as const };

afterEach(() => {
  eventBridge.reset();
});
afterAll(() => client.destroy());

test('publishes the completion event and requires an EventBridge receipt', async () => {
  eventBridge.on(PutEventsCommand).resolves({
    FailedEntryCount: 0,
    Entries: [{ EventId: 'receipt' }],
  });

  await publisher.publish(completion);
  const command = eventBridge.commandCalls(PutEventsCommand)[0]?.args[0].input;
  expect(command?.Entries).toHaveLength(1);
  expect(command?.Entries?.[0]).toMatchObject({
    EventBusName: 'appointment-bus',
    Source: 'rimac.appointments',
    DetailType: 'appointment.completed',
  });
  expect(JSON.parse(command?.Entries?.[0]?.Detail ?? '')).toEqual(completion);
});

test.each([
  { FailedEntryCount: 1, Entries: [{ ErrorCode: 'InternalFailure' }] },
  { FailedEntryCount: 0, Entries: [{ ErrorCode: 'AccessDeniedException' }] },
])('rejects a per-entry EventBridge error', async (response) => {
  eventBridge.on(PutEventsCommand).resolves(response);
  await expect(publisher.publish(completion)).rejects.toMatchObject({
    message: 'EventBridge rejected confirmation',
    code: response.Entries[0]?.ErrorCode,
  });
});

test('rejects a missing receipt and propagates SDK errors', async () => {
  eventBridge.on(PutEventsCommand).resolves({ FailedEntryCount: 0, Entries: [] });
  await expect(publisher.publish(completion)).rejects.toThrow('Missing EventBridge receipt');

  eventBridge.reset();
  eventBridge.on(PutEventsCommand).rejects(new Error('EventBridge unavailable'));
  await expect(publisher.publish(completion)).rejects.toThrow('EventBridge unavailable');
});

test('rejects an invalid completion before calling EventBridge', async () => {
  await expect(publisher.publish({ ...completion, eventId: 'invalid' })).rejects.toThrow();
  expect(eventBridge.commandCalls(PutEventsCommand)).toHaveLength(0);
});
