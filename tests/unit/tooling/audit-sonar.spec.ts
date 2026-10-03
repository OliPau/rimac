import { expect, test } from '@jest/globals';
import { pendingIssues } from '../../../scripts/audit-sonar.ts';

test('Sonar findings need a matching review, including rule and component', () => {
  const issues = [
    { key: 'A', rule: 'rule-1', component: 'src/one.ts', message: 'First issue' },
    { key: 'B', rule: 'rule-2', component: 'src/two.ts', message: 'Second issue' },
  ];
  const reviews = [
    {
      key: 'A',
      rule: 'rule-1',
      component: 'src/one.ts',
      justification: 'A documented and reviewed project-specific reason.',
    },
    {
      key: 'B',
      rule: 'rule-2',
      component: 'src/other.ts',
      justification: 'A documented and reviewed project-specific reason.',
    },
  ];
  expect(pendingIssues(issues, reviews)).toEqual([issues[1]]);
});
