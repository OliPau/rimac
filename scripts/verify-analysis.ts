import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const runSchema = z.object({
  workflow_runs: z.array(
    z.object({
      id: z.number(),
      head_sha: z.string(),
      head_branch: z.string().nullable(),
      event: z.string(),
      status: z.string(),
      conclusion: z.string().nullable(),
      html_url: z.url(),
    }),
  ),
});

interface Context {
  repository: string;
  revision: string;
  token: string;
}

export async function verifyAnalyses(context: Context, request = fetch) {
  const verified = [];
  for (const workflow of ['ci.yml', 'security.yml']) {
    const url = new URL(
      `https://api.github.com/repos/${context.repository}/actions/workflows/${workflow}/runs`,
    );
    url.searchParams.set('head_sha', context.revision);
    url.searchParams.set('event', 'push');
    url.searchParams.set('per_page', '1');
    const response = await request(url, {
      headers: {
        Authorization: `Bearer ${context.token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    assert.ok(response.ok, `Cannot verify ${workflow}: ${response.status}`);
    const run = runSchema.parse(await response.json()).workflow_runs[0];
    assert.ok(
      run &&
        run.head_sha === context.revision &&
        run.head_branch === 'main' &&
        run.event === 'push' &&
        run.status === 'completed' &&
        run.conclusion === 'success',
      `${workflow} must have passed for ${context.revision}`,
    );
    verified.push({ workflow, revision: context.revision, url: run.html_url, runId: run.id });
  }
  return verified;
}

async function main(): Promise<void> {
  const { GITHUB_REPOSITORY: repository, GITHUB_SHA: revision, GH_TOKEN: token } = process.env;
  assert.ok(repository && revision && token, 'Missing GitHub analysis verification context');
  const verified = await verifyAnalyses({ repository, revision, token });
  await mkdir('delivery', { recursive: true });
  await writeFile('delivery/analysis-verification.json', JSON.stringify(verified, null, 2));
  console.log(`Checks and dependency security passed for ${revision}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
