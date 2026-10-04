import { prefix, project } from './config.ts';
import type { Resource, Resources } from './types.ts';

const ref = (name: string) => ({ Ref: name });
const arn = (name: string) => ({ 'Fn::GetAtt': [name, 'Arn'] });
const alarmActions = [ref('Alerts')];

function alarm(name: string, properties: Record<string, unknown>): Resource {
  return {
    Type: 'AWS::CloudWatch::Alarm',
    DependsOn: ['AlertsPolicy'],
    Properties: {
      AlarmName: `${prefix}-${name}`,
      Statistic: 'Sum',
      Period: 60,
      EvaluationPeriods: 1,
      Threshold: 0,
      ComparisonOperator: 'GreaterThanThreshold',
      TreatMissingData: 'notBreaching',
      AlarmActions: alarmActions,
      ...properties,
    },
  };
}

export function monitoring(): Resources {
  const resources: Resources = {
    AlertsKey: {
      Type: 'AWS::KMS::Key',
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: {
        Description: 'Encryption for operational alerts',
        EnableKeyRotation: true,
        KeyPolicy: {
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'AccountAdministration',
              Effect: 'Allow',
              Principal: { AWS: { 'Fn::Sub': 'arn:aws:iam::${AWS::AccountId}:root' } },
              Action: 'kms:*',
              Resource: '*',
            },
            {
              Sid: 'CloudWatchNotifications',
              Effect: 'Allow',
              Principal: { Service: 'cloudwatch.amazonaws.com' },
              Action: ['kms:GenerateDataKey*', 'kms:Decrypt'],
              Resource: '*',
              Condition: {
                StringEquals: { 'aws:SourceAccount': { Ref: 'AWS::AccountId' } },
                ArnLike: {
                  'aws:SourceArn': {
                    'Fn::Sub': `arn:aws:cloudwatch:\${AWS::Region}:\${AWS::AccountId}:alarm:${prefix}-*`,
                  },
                },
              },
            },
          ],
        },
        Tags: [{ Key: 'Project', Value: project.service }],
      },
    },
    Alerts: {
      Type: 'AWS::SNS::Topic',
      Properties: {
        TopicName: `${prefix}-alerts`,
        KmsMasterKeyId: arn('AlertsKey'),
        Tags: [{ Key: 'Project', Value: project.service }],
      },
    },
    AlertsPolicy: {
      Type: 'AWS::SNS::TopicPolicy',
      Properties: {
        Topics: [ref('Alerts')],
        PolicyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { Service: 'cloudwatch.amazonaws.com' },
              Action: 'sns:Publish',
              Resource: ref('Alerts'),
              Condition: {
                StringEquals: { 'aws:SourceAccount': { Ref: 'AWS::AccountId' } },
                ArnLike: {
                  'aws:SourceArn': {
                    'Fn::Sub': `arn:aws:cloudwatch:\${AWS::Region}:\${AWS::AccountId}:alarm:${prefix}-*`,
                  },
                },
              },
            },
          ],
        },
      },
    },
    AlertsSubscription: {
      Type: 'AWS::SNS::Subscription',
      Properties: {
        TopicArn: ref('Alerts'),
        Protocol: 'email',
        Endpoint: '${env:ALERT_EMAIL}',
      },
    },
  };

  for (const name of [
    'DeliveryDLQPE',
    'DeliveryDLQCL',
    'WorkerDLQPE',
    'WorkerDLQCL',
    'ConfirmationDLQ',
    'EventDeliveryDLQ',
  ]) {
    resources[`${name}Alarm`] = alarm(`${name}-messages`, {
      Namespace: 'AWS/SQS',
      MetricName: 'ApproximateNumberOfMessagesVisible',
      Statistic: 'Maximum',
      Dimensions: [{ Name: 'QueueName', Value: { 'Fn::GetAtt': [name, 'QueueName'] } }],
    });
  }

  for (const [logicalName, functionName] of [
    ['Appointment', 'appointment'],
    ['Swagger', 'swagger'],
    ['WorkerPE', 'worker-pe'],
    ['WorkerCL', 'worker-cl'],
  ]) {
    resources[`${logicalName}Errors`] = alarm(`${functionName}-errors`, {
      Namespace: 'AWS/Lambda',
      MetricName: 'Errors',
      Dimensions: [{ Name: 'FunctionName', Value: `${prefix}-${functionName}` }],
    });
    resources[`${logicalName}HandledErrorsFilter`] = {
      Type: 'AWS::Logs::MetricFilter',
      Properties: {
        LogGroupName: ref(`${logicalName}LogGroup`),
        FilterPattern: '{ $.level = "ERROR" }',
        MetricTransformations: [
          { MetricNamespace: 'RimacLearning', MetricName: 'HandledErrors', MetricValue: '1' },
        ],
      },
    };
  }

  resources.HandledErrors = alarm('handled-errors', {
    Namespace: 'RimacLearning',
    MetricName: 'HandledErrors',
  });

  for (const name of ['QueuePE', 'QueueCL', 'ConfirmationQueue']) {
    const dimension = [{ Name: 'QueueName', Value: { 'Fn::GetAtt': [name, 'QueueName'] } }];
    resources[`${name}Age`] = alarm(`${name}-age`, {
      Namespace: 'AWS/SQS',
      MetricName: 'ApproximateAgeOfOldestMessage',
      Statistic: 'Maximum',
      EvaluationPeriods: 2,
      Threshold: 300,
      Dimensions: dimension,
    });
    resources[`${name}Backlog`] = alarm(`${name}-backlog`, {
      Namespace: 'AWS/SQS',
      MetricName: 'ApproximateNumberOfMessagesVisible',
      Statistic: 'Maximum',
      EvaluationPeriods: 2,
      Threshold: 20,
      Dimensions: dimension,
    });
  }

  return resources;
}
