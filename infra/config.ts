export const project = {
  service: 'rimac-learning',
  stage: 'learning',
  region: 'us-east-1',
} as const;

export const prefix = `${project.service}-${project.stage}`;
export const resource = (name: string) => `${prefix}-${name}`;
