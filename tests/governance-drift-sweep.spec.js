const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildReport, classifyIssue, classifyIssues } = require('../scripts/global/governance-drift-sweep');

test('classifies the seed D1-D8 patterns', () => {
  const issues = [
    { number: 1, state: 'open', title: 'plain ticket', body: '', labels: [] },
    { number: 2, state: 'open', title: 'in progress', body: '', labels: ['status:in-progress'] },
    { number: 3, state: 'open', title: 'fix: title drift', body: '', labels: ['status:triage'] },
    { number: 4, state: 'open', title: 'open resolution', body: '', labels: ['resolution:released'] },
    { number: 5, state: 'open', title: 'child', body: 'Parent: #9', labels: ['status:backlog'] },
    { number: 6, state: 'open', title: 'epic', body: '', labels: ['type:epic', 'status:dormant'] },
    { number: 7, state: 'open', title: 'coord', body: '', labels: ['coordinator:cross-team-needs-hand-off'] },
    { number: 8, state: 'open', title: 'epic', body: '', labels: ['type:epic', 'phase-gate:phase-1'] },
    { number: 9, state: 'open', title: 'parent epic', body: '', labels: ['type:epic', 'status:in-progress', 'role:manager'] },
  ];
  const result = classifyIssues(issues);
  assert.ok(classifyIssue(issues[0], new Map([[9, issues[8]]])).includes('D1'));
  assert.deepEqual(result.details.D2, [2]);
  assert.deepEqual(result.details.D3, [3]);
  assert.deepEqual(result.details.D4, [4]);
  assert.deepEqual(result.details.D5, [5]);
  assert.deepEqual(result.details.D6, [6]);
  assert.deepEqual(result.details.D7, [7]);
  assert.deepEqual(result.details.D8, [8]);
});

test('builds a deterministic scan report', () => {
  const report = buildReport([{ number: 1, state: 'open', title: 'plain ticket', body: '', labels: [] }]);
  assert.equal(report.mode, 'scan');
  assert.equal(report.route, 'deterministic');
  assert.equal(report.premiumLaneProhibited, true);
  assert.equal(report.counts.D1, 1);
  assert.equal(report.status, 'fail');
});
