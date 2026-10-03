import { PutEventsCommand, type EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import type { ConfirmationPublisher, Publisher } from '@application/appointments/ports/messaging';
import type { CompletionEvent, Event } from '@domain/appointments/index';
import { completion as completionSchema, event as eventSchema } from './dto/event.dto.ts';

export class SnsPublisher implements Publisher {
  constructor(
    private readonly client: SNSClient,
    private readonly topicArn: string,
  ) {}

  async publish(event: Event): Promise<void> {
    const message = eventSchema.parse(event);
    await this.client.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        Message: JSON.stringify(message),
        MessageAttributes: {
          countryISO: { DataType: 'String', StringValue: message.countryISO },
        },
      }),
    );
  }
}

export class CompletionPublisher implements ConfirmationPublisher {
  constructor(
    private readonly client: EventBridgeClient,
    private readonly bus: string,
  ) {}

  async publish(event: CompletionEvent): Promise<void> {
    const message = completionSchema.parse(event);
    const result = await this.client.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: this.bus,
            Source: 'rimac.appointments',
            DetailType: message.type,
            Detail: JSON.stringify(message),
          },
        ],
      }),
    );
    if (result.FailedEntryCount || result.Entries?.some((entry) => entry.ErrorCode)) {
      throw new Error('EventBridge rejected confirmation');
    }
    if (!result.Entries?.[0]?.EventId) {
      throw new Error('Missing EventBridge receipt');
    }
  }
}
