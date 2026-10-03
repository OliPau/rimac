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
                      Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query'],
                      Resource: { 'Fn::GetAtt': ['Appointments', 'Arn'] },
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
