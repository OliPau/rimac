import { expect, test } from '@jest/globals';
import { service } from '../../../infra/service.ts';

test('connects POST and GET to the appointment table and execution role', () => {
  const config = service();

  expect(config).toMatchObject({
    provider: {
      name: 'aws',
      runtime: 'nodejs24.x',
      region: 'us-east-1',
      deploymentBucket: { name: 'rimac-learning-learning-artifacts-${aws:accountId}' },
    },
    package: { individually: true },
    functions: {
      appointment: {
        handler: 'src/handlers/appointment.handler',
        package: { artifact: '.local/artifacts/appointment.zip' },
        role: { 'Fn::GetAtt': ['AppointmentRole', 'Arn'] },
        environment: { APPOINTMENTS_TABLE: 'rimac-learning-learning-appointments' },
        events: [
          { httpApi: { method: 'POST', path: '/appointments' } },
          { httpApi: { method: 'GET', path: '/appointments/{insuredId}' } },
          {
            sqs: {
              arn: { 'Fn::GetAtt': ['ConfirmationQueue', 'Arn'] },
              batchSize: 5,
              functionResponseType: 'ReportBatchItemFailures',
            },
          },
        ],
      },
    },
    resources: {
      Resources: {
        Appointments: {
          Type: 'AWS::DynamoDB::Table',
          Properties: {
            TableName: 'rimac-learning-learning-appointments',
            BillingMode: 'PAY_PER_REQUEST',
            SSESpecification: { SSEEnabled: true },
            KeySchema: [
              { AttributeName: 'insuredId', KeyType: 'HASH' },
              { AttributeName: 'appointmentId', KeyType: 'RANGE' },
            ],
          },
        },
        AppointmentRole: {
          Type: 'AWS::IAM::Role',
          Properties: {
            Policies: [
              {
                PolicyDocument: {
                  Statement: [
                    { Action: ['logs:CreateLogStream', 'logs:PutLogEvents'] },
                    {
                      Action: [
                        'dynamodb:GetItem',
                        'dynamodb:PutItem',
                        'dynamodb:Query',
                        'dynamodb:UpdateItem',
                      ],
                      Resource: { 'Fn::GetAtt': ['Appointments', 'Arn'] },
                    },
                    { Action: ['sns:Publish'], Resource: { Ref: 'Topic' } },
                    {
                      Action: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
                      Resource: { 'Fn::GetAtt': ['ConfirmationQueue', 'Arn'] },
                    },
                    {
                      Action: ['kms:GenerateDataKey', 'kms:Decrypt'],
                      Condition: {
                        StringEquals: { 'kms:ViaService': 'sns.us-east-1.amazonaws.com' },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  });
});

test('exposes Swagger through its own Lambda and secret-scoped role', () => {
  expect(service()).toMatchObject({
    functions: {
      swagger: {
        handler: 'src/handlers/swagger.handler',
        package: { artifact: '.local/artifacts/swagger.zip' },
        role: { 'Fn::GetAtt': ['SwaggerRole', 'Arn'] },
        environment: { SWAGGER_SECRET_ARN: '${env:SWAGGER_SECRET_ARN}' },
        events: [
          { httpApi: { method: 'GET', path: '/swagger' } },
          { httpApi: { method: 'GET', path: '/swagger/{proxy+}' } },
        ],
      },
    },
    resources: {
      Resources: {
        SwaggerRole: {
          Properties: {
            Policies: [
              {
                PolicyDocument: {
                  Statement: [
                    { Action: ['logs:CreateLogStream', 'logs:PutLogEvents'] },
                    {
                      Action: ['secretsmanager:GetSecretValue'],
                      Resource: '${env:SWAGGER_SECRET_ARN}',
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    },
  });
});

test('routes each country to its own queue with a delivery dead letter queue', () => {
  const config = service();
  const resources: Record<string, unknown> = config.resources.Resources;
  expect(config.functions?.appointment).toMatchObject({
    environment: { TOPIC_ARN: { Ref: 'Topic' } },
  });
  expect(resources.Topic).toMatchObject({
    Type: 'AWS::SNS::Topic',
    Properties: { TopicName: 'rimac-learning-learning', KmsMasterKeyId: 'alias/aws/sns' },
  });
  for (const country of ['PE', 'CL']) {
    expect(resources[`Queue${country}`]).toMatchObject({
      Type: 'AWS::SQS::Queue',
      Properties: {
        SqsManagedSseEnabled: true,
        MessageRetentionPeriod: 1209600,
      },
    });
    expect(resources[`DeliveryDLQ${country}`]).toMatchObject({
      Type: 'AWS::SQS::Queue',
      Properties: { MessageRetentionPeriod: 1209600 },
    });
    expect(resources[`Policy${country}`]).toMatchObject({
      Type: 'AWS::SQS::QueuePolicy',
      Properties: {
        PolicyDocument: {
          Statement: [{ Condition: { ArnEquals: { 'aws:SourceArn': { Ref: 'Topic' } } } }],
        },
      },
    });
    expect(resources[`Subscription${country}`]).toMatchObject({
      Type: 'AWS::SNS::Subscription',
      DependsOn: [`Policy${country}`, `DeliveryPolicy${country}`],
      Properties: {
        Endpoint: { 'Fn::GetAtt': [`Queue${country}`, 'Arn'] },
        RawMessageDelivery: true,
        FilterPolicy: { countryISO: [country] },
        RedrivePolicy: {
          deadLetterTargetArn: { 'Fn::GetAtt': [`DeliveryDLQ${country}`, 'Arn'] },
        },
      },
    });
  }
});

test('routes completed events to a retryable queue with delivery and processing DLQs', () => {
  const resources: Record<string, unknown> = service().resources.Resources;
  expect(resources.Bus).toMatchObject({ Type: 'AWS::Events::EventBus' });
  expect(resources.CompletionRule).toMatchObject({
    Type: 'AWS::Events::Rule',
    Properties: {
      EventBusName: { Ref: 'Bus' },
      EventPattern: { source: ['rimac.appointments'], 'detail-type': ['appointment.completed'] },
      Targets: [
        {
          Arn: { 'Fn::GetAtt': ['ConfirmationQueue', 'Arn'] },
          InputPath: '$.detail',
          DeadLetterConfig: { Arn: { 'Fn::GetAtt': ['EventDeliveryDLQ', 'Arn'] } },
        },
      ],
    },
  });
  expect(resources.ConfirmationQueue).toMatchObject({
    Type: 'AWS::SQS::Queue',
    Properties: {
      VisibilityTimeout: 90,
      RedrivePolicy: {
        deadLetterTargetArn: { 'Fn::GetAtt': ['ConfirmationDLQ', 'Arn'] },
        maxReceiveCount: 5,
      },
    },
  });
  for (const name of ['ConfirmationPolicy', 'EventDeliveryPolicy']) {
    expect(resources[name]).toMatchObject({
      Properties: {
        PolicyDocument: {
          Statement: [
            {
              Principal: { Service: 'events.amazonaws.com' },
              Condition: {
                ArnEquals: { 'aws:SourceArn': { 'Fn::GetAtt': ['CompletionRule', 'Arn'] } },
              },
            },
          ],
        },
      },
    });
  }
});
