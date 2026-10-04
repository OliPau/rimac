import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  UpdateTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';

const table = 'rimac-learning-appointments';
const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://127.0.0.1:8000',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

try {
  for (let attempt = 0; ; attempt++) {
    try {
      await client.send(new ListTablesCommand({ Limit: 1 }));
      break;
    } catch (error) {
      if (attempt === 19) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  try {
    await client.send(
      new CreateTableCommand({
        TableName: table,
        BillingMode: 'PAY_PER_REQUEST',
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
      }),
    );
  } catch (error) {
    if (!(error instanceof Error && error.name === 'ResourceInUseException')) {
      throw error;
    }
  }
  await waitUntilTableExists(
    { client, minDelay: 1, maxDelay: 2, maxWaitTime: 10 },
    { TableName: table },
  );
  const existing = await client.send(new DescribeTableCommand({ TableName: table }));
  if (
    !existing.Table?.GlobalSecondaryIndexes?.some(
      (index) => index.IndexName === 'insured-created-at',
    )
  ) {
    await client.send(
      new UpdateTableCommand({
        TableName: table,
        AttributeDefinitions: [{ AttributeName: 'createdAt', AttributeType: 'S' }],
        GlobalSecondaryIndexUpdates: [
          {
            Create: {
              IndexName: 'insured-created-at',
              KeySchema: [
                { AttributeName: 'insuredId', KeyType: 'HASH' },
                { AttributeName: 'createdAt', KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          },
        ],
      }),
    );
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await client.send(new DescribeTableCommand({ TableName: table }));
    if (current.Table?.GlobalSecondaryIndexes?.some((index) => index.IndexStatus === 'ACTIVE')) {
      break;
    }
    if (attempt === 19) {
      throw new Error('Local appointment index did not become active');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.log('Local appointment table ready');
} finally {
  client.destroy();
}
