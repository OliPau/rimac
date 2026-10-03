import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import type { QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import type { Appointment, Request } from '@domain/appointments/index';
import { identity } from '@domain/appointments/index';
import type { Acceptance } from '@application/appointments/dto/create.dto';
import { accept } from '@application/appointments/helpers/registration';
import type { Appointments } from '@application/appointments/ports/repositories';
import { appointment } from '@infrastructure/shared/appointment.schema';

export class DynamoAppointments implements Appointments {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly table: string,
  ) {}

  private async read(key: { insuredId: string; appointmentId: string }) {
    const result = await this.client.send(
      new GetCommand({
        Key: key,
        ConsistentRead: true,
        TableName: this.table,
      }),
    );
    return result.Item ? appointment.parse(result.Item) : undefined;
  }

  async create(input: Request): Promise<Acceptance> {
    const { appointmentId } = identity(input);
    const key = {
      appointmentId,
      insuredId: input.insuredId,
    };
    const existing = await this.read(key);
    if (existing) {
      return accept(existing.appointmentId, existing.createdAt, existing.status);
    }

    const createdAt = new Date().toISOString();
    const item: Appointment = {
      ...input,
      createdAt,
      appointmentId,
      status: 'pending',
    };
    try {
      await this.client.send(
        new PutCommand({
          Item: item,
          TableName: this.table,
          ConditionExpression: 'attribute_not_exists(appointmentId)',
        }),
      );
      return accept(appointmentId, createdAt);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'ConditionalCheckFailedException')) {
        throw error;
      }
    }

    const storedAppointment = await this.read(key);
    if (!storedAppointment) {
      throw new Error('Concurrent appointment could not be read');
    }
    return accept(
      storedAppointment.appointmentId,
      storedAppointment.createdAt,
      storedAppointment.status,
    );
  }

  async list(insuredId: string): Promise<{ items: Appointment[] }> {
    const items: Appointment[] = [];
    let cursor: QueryCommandInput['ExclusiveStartKey'];
    do {
      const result = await this.client.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: 'insuredId = :insuredId',
          ExpressionAttributeValues: { ':insuredId': insuredId },
          ConsistentRead: true,
          ...(cursor ? { ExclusiveStartKey: cursor } : {}),
        }),
      );
      items.push(...(result.Items ?? []).map((item) => appointment.parse(item)));
      cursor = result.LastEvaluatedKey;
    } while (cursor);
    return { items };
  }
}
