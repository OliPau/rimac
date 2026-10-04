import { prefix, project, swaggerSecret } from './config.ts';
import type { Resource, Resources } from './types.ts';

function lambdaRole(name: string, permissions: Record<string, unknown>[]): Resource {
  return {
    Type: 'AWS::IAM::Role',
    Properties: {
      RoleName: `${prefix}-${name}`,
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      Policies: [
        {
          PolicyName: 'runtime',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                Resource: {
                  'Fn::Sub':
                    'arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/' +
                    `${prefix}-${name}:*`,
                },
              },
              ...permissions,
            ],
          },
        },
      ],
    },
  };
}

export function roles(): Resources {
  return {
    AppointmentRole: lambdaRole('appointment', [
      {
        Effect: 'Allow',
        Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query', 'dynamodb:UpdateItem'],
        Resource: { 'Fn::GetAtt': ['Appointments', 'Arn'] },
      },
      {
        Effect: 'Allow',
        Action: ['sns:Publish'],
        Resource: { Ref: 'Topic' },
      },
      {
        Effect: 'Allow',
        Action: ['sqs:ReceiveMessage', 'sqs:DeleteMessage', 'sqs:GetQueueAttributes'],
        Resource: { 'Fn::GetAtt': ['ConfirmationQueue', 'Arn'] },
      },
      {
        Effect: 'Allow',
        Action: ['kms:GenerateDataKey', 'kms:Decrypt'],
        Resource: '*',
        Condition: { StringEquals: { 'kms:ViaService': `sns.${project.region}.amazonaws.com` } },
      },
    ]),
    SwaggerRole: lambdaRole('swagger', [
      {
        Effect: 'Allow',
        Action: ['secretsmanager:GetSecretValue'],
        Resource: swaggerSecret,
      },
    ]),
  };
}
