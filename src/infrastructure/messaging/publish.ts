import { PublishCommand, type SNSClient } from '@aws-sdk/client-sns';
import type { Publisher } from '@application/appointments/ports/messaging';
import type { Event } from '@domain/appointments/index';
import { event as eventSchema } from './dto/event.dto.ts';

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
