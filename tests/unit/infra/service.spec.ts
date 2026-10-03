import { expect, test } from '@jest/globals';
import { service } from '../../../infra/service.ts';

test('connects the POST Lambda, appointment table and its execution role', () => {
  const config = service();

  expect(config).toMatchObject({
    provider: { name: 'aws', runtime: 'nodejs24.x', region: 'us-east-1' },
    package: { individually: true },
    functions: {
      appointment: {
        handler: 'src/handlers/appointment.handler',
        package: { artifact: '.local/artifacts/appointment.zip' },
        role: { 'Fn::GetAtt': ['AppointmentRole', 'Arn'] },
        environment: { APPOINTMENTS_TABLE: 'rimac-learning-learning-appointments' },
        events: [{ httpApi: { method: 'POST', path: '/appointments' } }],
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
                      Action: ['dynamodb:GetItem', 'dynamodb:PutItem'],
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
  expect(config.provider).not.toHaveProperty('deploymentBucket');
});
