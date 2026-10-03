import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';

const issueSchema = z.object({
  key: z.string(),
  rule: z.string(),
  component: z.string(),
  message: z.string(),
  line: z.number().optional(),
});
const reviewsSchema = z.array(
  z.object({
    key: z.string(),
    rule: z.string(),
    component: z.string(),
    justification: z.string().trim().min(30),
  }),
);
type Issue = z.infer<typeof issueSchema>;
type Review = z.infer<typeof reviewsSchema>[number];

export function pendingIssues(issues: Issue[], reviews: Review[]): Issue[] {
  return issues.filter(
    (issue) =>
      !reviews.some(
        (review) =>
          review.key === issue.key &&
          review.rule === issue.rule &&
          review.component === issue.component,
      ),
  );
}

async function main(): Promise<void> {
  const project = process.env.SONAR_PROJECT_KEY;
  const token = process.env.SONAR_TOKEN;
  const revision = process.env.GITHUB_SHA;
  assert.ok(project && token && revision, 'Sonar project, token and GitHub SHA are required');

  async function query(path: string, parameters: Record<string, string>): Promise<unknown> {
    const url = new URL(path, 'https://sonarcloud.io');
    url.search = new URLSearchParams(parameters).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.ok(response.ok, `Sonar API failed: ${response.status}`);
    return response.json();
  }

  const analyses = z
    .object({ analyses: z.array(z.object({ key: z.string(), revision: z.string().optional() })) })
    .parse(await query('/api/project_analyses/search', { project, branch: 'main', ps: '1' }));
  const analysis = analyses.analyses[0];
  assert.ok(analysis && analysis.revision === revision, 'Sonar must analyze this GitHub SHA');

  const gate = z
    .object({ projectStatus: z.object({ status: z.string() }) })
    .parse(await query('/api/qualitygates/project_status', { analysisId: analysis.key }));
  assert.equal(gate.projectStatus.status, 'OK', 'Sonar quality gate must pass');

  const issues: Issue[] = [];
  for (let page = 1; ; page++) {
    const result = z.object({ total: z.number(), issues: z.array(issueSchema) }).parse(
      await query('/api/issues/search', {
        componentKeys: project,
        branch: 'main',
        resolved: 'false',
        ps: '500',
        p: String(page),
      }),
    );
    issues.push(...result.issues);
    if (issues.length >= result.total) {
      break;
    }
    assert.ok(result.issues.length > 0, 'Sonar returned an incomplete issue page');
  }

  const reviews = reviewsSchema.parse(
    JSON.parse(await readFile('infra/security-context.json', 'utf8')),
  );
  const pending = pendingIssues(issues, reviews);
  await mkdir('delivery', { recursive: true });
  await writeFile(
    'delivery/sonar-audit.json',
    JSON.stringify({ revision, analysis: analysis.key, gate, issues, reviews, pending }, null, 2),
  );
  console.log(
    JSON.stringify(
      { revision, total: issues.length, justified: issues.length - pending.length, pending },
      null,
      2,
    ),
  );
  assert.equal(pending.length, 0, 'Unreviewed Sonar findings remain');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
