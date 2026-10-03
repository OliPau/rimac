import type { Config } from 'jest';

export function testConfig(mode: string): Config {
  const coverage = mode === 'coverage';
  return {
    rootDir: process.cwd().replaceAll('\\', '/'),
    testEnvironment: 'node',
    testMatch: coverage
      ? ['**/tests/unit/**/*.spec.ts', '**/tests/integration/**/*.spec.ts']
      : [`**/tests/${mode}/**/*.spec.ts`],
    testTimeout: 60_000,
    maxWorkers: 2,
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
      '^.+\\.tsx?$': [
        'ts-jest',
        {
          useESM: true,
          tsconfig: { module: 'ESNext', moduleResolution: 'Bundler', isolatedModules: true },
        },
      ],
    },
    moduleNameMapper: {
      '^@domain/(.*)$': '<rootDir>/src/domain/$1.ts',
      '^@application/(.*)$': '<rootDir>/src/application/$1.ts',
      '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1.ts',
    },
    collectCoverage: coverage,
    collectCoverageFrom: ['src/**/*.ts'],
    coverageProvider: 'babel',
    coverageReporters: ['text', 'json', 'json-summary', 'html', 'lcov'],
  };
}
