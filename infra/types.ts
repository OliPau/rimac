import type { AWS } from '@serverless/typescript';

export type Functions = NonNullable<AWS['functions']>;

export interface Resource {
  Type: string;
  Properties: Record<string, unknown>;
  DependsOn?: string[];
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
}

export type Resources = Record<string, Resource>;

export interface Table {
  Type: 'AWS::DynamoDB::Table';
  Properties: {
    TableName: string;
    BillingMode: 'PAY_PER_REQUEST';
    SSESpecification: { SSEEnabled: boolean };
    AttributeDefinitions: { AttributeName: string; AttributeType: 'S' }[];
    KeySchema: { AttributeName: string; KeyType: 'HASH' | 'RANGE' }[];
  };
}
