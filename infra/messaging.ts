import { prefix } from './config.ts';
import type { Resource, Resources } from './types.ts';

const arn = (name: string) => ({ 'Fn::GetAtt': [name, 'Arn'] });
const ref = (name: string) => ({ Ref: name });

function queue(name: string): Resource {
  return {
    Type: 'AWS::SQS::Queue',
    Properties: {
      QueueName: `${prefix}-${name}`,
      SqsManagedSseEnabled: true,
      MessageRetentionPeriod: 1209600,
      VisibilityTimeout: 360,
    },
  };
}

function deliveryPolicy(queueName: string): Resource {
  return {
    Type: 'AWS::SQS::QueuePolicy',
    Properties: {
      Queues: [ref(queueName)],
      PolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'sns.amazonaws.com' },
            Action: 'sqs:SendMessage',
            Resource: arn(queueName),
            Condition: { ArnEquals: { 'aws:SourceArn': ref('Topic') } },
          },
        ],
      },
    },
  };
}

export function messaging(): Resources {
  const resources: Resources = {
    Topic: {
      Type: 'AWS::SNS::Topic',
      Properties: { TopicName: prefix, KmsMasterKeyId: 'alias/aws/sns' },
    },
  };

  for (const country of ['PE', 'CL'] as const) {
    resources[`DeliveryDLQ${country}`] = queue(`${country}-delivery-dlq`);
    resources[`Queue${country}`] = queue(`SQS_${country}`);
    resources[`Policy${country}`] = deliveryPolicy(`Queue${country}`);
    resources[`DeliveryPolicy${country}`] = deliveryPolicy(`DeliveryDLQ${country}`);
    resources[`Subscription${country}`] = {
      Type: 'AWS::SNS::Subscription',
      Properties: {
        TopicArn: ref('Topic'),
        Protocol: 'sqs',
        Endpoint: arn(`Queue${country}`),
        RawMessageDelivery: true,
        FilterPolicy: { countryISO: [country] },
        RedrivePolicy: { deadLetterTargetArn: arn(`DeliveryDLQ${country}`) },
      },
      DependsOn: [`Policy${country}`, `DeliveryPolicy${country}`],
    };
  }

  return resources;
}
