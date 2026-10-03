import { prefix } from './config.ts';
import type { Resources } from './types.ts';

export function roles(): Resources {
  return {
    AppointmentRole: {
      Type: 'AWS::IAM::Role',
      Properties: {
        RoleName: `${prefix}-appointment`,
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
                      `${prefix}-appointment:*`,
                  },
                },
                {
                  Effect: 'Allow',
                  Action: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:Query'],
                  Resource: { 'Fn::GetAtt': ['Appointments', 'Arn'] },
                },
              ],
            },
          },
        ],
      },
    },
  };
}
