export const project = {
  service: 'rimac-learning',
  stage: 'learning',
  region: 'us-east-1',
} as const;

export const prefix = `${project.service}-${project.stage}`;
export const resource = (name: string) => `${prefix}-${name}`;
export const swaggerSecret = '${env:SWAGGER_SECRET_ARN}';
export const mysqlSecrets = {
  PE: '${env:SQL_SECRET_PE_ARN}',
  CL: '${env:SQL_SECRET_CL_ARN}',
} as const;
