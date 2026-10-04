import { resource } from './config.ts';
import type { Table } from './types.ts';

export function tables(): Record<'Appointments', Table> {
  return {
    Appointments: {
      Type: 'AWS::DynamoDB::Table',
      Properties: {
        TableName: resource('appointments'),
        BillingMode: 'PAY_PER_REQUEST',
        SSESpecification: { SSEEnabled: true },
        AttributeDefinitions: [
          { AttributeName: 'insuredId', AttributeType: 'S' },
          { AttributeName: 'appointmentId', AttributeType: 'S' },
          { AttributeName: 'createdAt', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'insuredId', KeyType: 'HASH' },
          { AttributeName: 'appointmentId', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'insured-created-at',
            KeySchema: [
              { AttributeName: 'insuredId', KeyType: 'HASH' },
              { AttributeName: 'createdAt', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      },
    },
  };
}
