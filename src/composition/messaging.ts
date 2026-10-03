import { SNSClient } from '@aws-sdk/client-sns';
import { SnsPublisher } from '@infrastructure/messaging/publish';
import { env } from './config.ts';

export const publisher = new SnsPublisher(new SNSClient({ maxAttempts: 2 }), env('TOPIC_ARN'));
