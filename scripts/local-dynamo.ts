import {
  CreateTableCommand,
  DynamoDBClient,
  ListTablesCommand,
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
        ],
        KeySchema: [
          { AttributeName: 'insuredId', KeyType: 'HASH' },
          { AttributeName: 'appointmentId', KeyType: 'RANGE' },
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
  console.log('Local appointment table ready');
} finally {
  client.destroy();
}
