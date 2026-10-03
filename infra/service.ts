import type { AWS } from '@serverless/typescript';
import { prefix, project, resource, swaggerSecret } from './config.ts';
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
      environment: { APPOINTMENTS_TABLE: resource('appointments') },
      events: [
        { httpApi: { method: 'POST', path: '/appointments' } },
        { httpApi: { method: 'GET', path: '/appointments/{insuredId}' } },
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
    resources: { Resources: { ...tables(), ...roles() } },
  } satisfies AWS;
}
