import type { AWS } from '@serverless/typescript';
import { project, resource } from './config.ts';
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
      events: [{ httpApi: { method: 'POST', path: '/appointments' } }],
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
    },
    build: { esbuild: false },
    package: { individually: true },
    functions,
    resources: { Resources: { ...tables(), ...roles() } },
  } satisfies AWS;
}
