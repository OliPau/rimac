import { expect, test } from '@jest/globals';
import { verifyAnalyses } from '../../../scripts/verify-analysis.ts';

const context = {
  repository: 'OliPau/rimac',
  revision: 'a'.repeat(40),
  token: 'test-token',
};

function run(workflow: string, conclusion: string, revision = context.revision) {
  return {
    workflow_runs: [
      {
        id: workflow === 'ci.yml' ? 1 : 2,
        head_sha: revision,
        head_branch: 'main',
        event: 'push',
        status: 'completed',
        conclusion,
        html_url: `https://github.com/OliPau/rimac/actions/runs/${workflow === 'ci.yml' ? 1 : 2}`,
      },
    ],
  };
}

function workflowFrom(input: URL | RequestInfo): string {
  if (!(input instanceof URL)) {
    throw new Error('Expected a GitHub API URL');
  }
  return input.pathname.includes('ci.yml') ? 'ci.yml' : 'security.yml';
}

test('accepts both successful push checks for the same revision', async () => {
  const request = async (input: URL | RequestInfo) => {
    const workflow = workflowFrom(input);
    return Response.json(run(workflow, 'success'));
  };
  await expect(verifyAnalyses(context, request)).resolves.toHaveLength(2);
});

test('rejects a security check from another revision', async () => {
  const request = async (input: URL | RequestInfo) => {
    const workflow = workflowFrom(input);
    return Response.json(
      run(workflow, 'success', workflow === 'ci.yml' ? context.revision : 'b'.repeat(40)),
    );
  };
  await expect(verifyAnalyses(context, request)).rejects.toThrow('security.yml must have passed');
});

test('rejects a failed security check for the same revision', async () => {
  const request = async (input: URL | RequestInfo) => {
    const workflow = workflowFrom(input);
    return Response.json(run(workflow, workflow === 'ci.yml' ? 'success' : 'failure'));
  };
  await expect(verifyAnalyses(context, request)).rejects.toThrow('security.yml must have passed');
});
