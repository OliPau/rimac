import { expect, test } from '@jest/globals';
import { service } from '../../../infra/service.ts';

test('limits only the appointment POST route', () => {
  const config = service();
  expect(config.resources.extensions?.HttpApiStage).toEqual({
    Properties: {
      RouteSettings: {
        'POST /appointments': { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
      },
    },
  });
});

test('alerts on failed deliveries, processing failures and aging source queues', () => {
  const resources: Record<string, unknown> = service().resources.Resources;
  expect(resources.AlertsKey).toMatchObject({
    Type: 'AWS::KMS::Key',
    DeletionPolicy: 'Retain',
    Properties: { EnableKeyRotation: true },
  });
  expect(resources.Alerts).toMatchObject({
    Type: 'AWS::SNS::Topic',
    Properties: { KmsMasterKeyId: { 'Fn::GetAtt': ['AlertsKey', 'Arn'] } },
  });
  expect(resources.AlertsSubscription).toMatchObject({
    Properties: { Protocol: 'email', Endpoint: '${env:ALERT_EMAIL}' },
  });

  for (const name of [
    'DeliveryDLQPE',
    'DeliveryDLQCL',
    'WorkerDLQPE',
    'WorkerDLQCL',
    'ConfirmationDLQ',
    'EventDeliveryDLQ',
  ]) {
    expect(resources[`${name}Alarm`]).toMatchObject({
      Type: 'AWS::CloudWatch::Alarm',
      Properties: {
        MetricName: 'ApproximateNumberOfMessagesVisible',
        Dimensions: [{ Name: 'QueueName', Value: { 'Fn::GetAtt': [name, 'QueueName'] } }],
        AlarmActions: [{ Ref: 'Alerts' }],
      },
    });
  }
  for (const name of ['QueuePE', 'QueueCL', 'ConfirmationQueue']) {
    expect(resources[`${name}Age`]).toMatchObject({
      Properties: { MetricName: 'ApproximateAgeOfOldestMessage', Threshold: 300 },
    });
    expect(resources[`${name}Backlog`]).toMatchObject({
      Properties: { MetricName: 'ApproximateNumberOfMessagesVisible', Threshold: 20 },
    });
  }
  for (const name of ['Appointment', 'Swagger', 'WorkerPE', 'WorkerCL']) {
    expect(resources[`${name}Errors`]).toMatchObject({
      Properties: { Namespace: 'AWS/Lambda', MetricName: 'Errors' },
    });
    expect(resources[`${name}HandledErrorsFilter`]).toMatchObject({
      Type: 'AWS::Logs::MetricFilter',
      Properties: {
        LogGroupName: { Ref: `${name}LogGroup` },
        FilterPattern: '{ $.level = "ERROR" }',
      },
    });
  }
});
