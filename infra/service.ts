import type { AWS } from '@serverless/typescript';
import { mysqlSecrets, prefix, project, resource, swaggerSecret } from './config.ts';
import { messaging } from './messaging.ts';
import { monitoring } from './monitoring.ts';
import { roles } from './roles.ts';
import { tables } from './tables.ts';
import type { Functions } from './types.ts';

export function service() {
  const functions: Functions = {
    appointment: {
      handler: 'src/handlers/appointment.handler',
      package: { artifact: '.local/artifacts/appointment.zip' },
      timeout: 15,
      role: { 'Fn::GetAtt': ['AppointmentRole', 'Arn'] },
      environment: { APPOINTMENTS_TABLE: resource('appointments'), TOPIC_ARN: { Ref: 'Topic' } },
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
    swagger: {
      handler: 'src/handlers/swagger.handler',
      package: { artifact: '.local/artifacts/swagger.zip' },
      timeout: 10,
      role: { 'Fn::GetAtt': ['SwaggerRole', 'Arn'] },
      environment: { SWAGGER_SECRET_ARN: swaggerSecret },
      events: [
        { httpApi: { method: 'GET', path: '/swagger' } },
        { httpApi: { method: 'GET', path: '/swagger/{proxy+}' } },
      ],
    },
  };

  for (const country of ['PE', 'CL'] as const) {
    functions[`worker${country}`] = {
      name: resource(`worker-${country.toLowerCase()}`),
      handler: 'src/handlers/worker.handler',
      package: { artifact: '.local/artifacts/worker.zip' },
      timeout: 30,
      reservedConcurrency: 2,
      role: { 'Fn::GetAtt': [`WorkerRole${country}`, 'Arn'] },
      environment: {
        COUNTRY: country,
        SQL_SECRET_ARN: mysqlSecrets[country],
        EVENT_BUS: { Ref: 'Bus' },
      },
      events: [
        {
          sqs: {
            arn: { 'Fn::GetAtt': [`Queue${country}`, 'Arn'] },
            batchSize: 5,
            maximumConcurrency: 2,
            functionResponseType: 'ReportBatchItemFailures',
          },
        },
      ],
    };
  }

  return {
    service: project.service,
    frameworkVersion: '4',
    configValidationMode: 'error',
    provider: {
      name: 'aws',
      runtime: 'nodejs24.x',
      stage: project.stage,
      region: project.region,
      logRetentionInDays: 7,
      httpApi: { cors: false },
      stackTags: { Project: project.service },
      tags: { Project: project.service },
      deploymentBucket: { name: `${prefix}-artifacts-${'${aws:accountId}'}` },
    },
    build: { esbuild: false },
    package: { individually: true },
    functions,
    resources: {
      Resources: { ...tables(), ...roles(), ...messaging(), ...monitoring() },
      extensions: {
        HttpApiStage: {
          Properties: {
            RouteSettings: {
              'POST /appointments': { ThrottlingRateLimit: 5, ThrottlingBurstLimit: 10 },
            },
          },
        },
      },
    },
  } satisfies AWS;
}
