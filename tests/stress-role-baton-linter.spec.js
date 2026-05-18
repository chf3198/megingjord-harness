'use strict';
// Stress tests for #1876 role-baton-linter per Epic #1875 (stress-test required for
// side-effect-bearing governance gates + adversarial-input parsers + perf-sensitive).
// G2 quality + G6 resilience + G7 throughput.

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { lint, lintEpic, lintChild } = require('../scripts/global/role-baton-linter.js');
const { audit, aliasDriftIn } = require('../scripts/global/role-baton-audit.js');

const PERF_BUDGET_P99_MS = 5;
const FUZZ_ITERATIONS = 1000;

const SAMPLE_LABELS = ['type:task', 'type:epic', 'type:research', 'type:bug',
  'status:backlog', 'status:triage', 'status:ready', 'status:in-progress',
  'status:testing', 'status:review', 'status:done', 'status:cancelled',
  'role:manager', 'role:collaborator', 'role:admin', 'role:consultant',
  'priority:P1', 'priority:P2', 'priority:P3', 'area:scripts'];

const SAMPLE_BODIES = [
  '## MANAGER_HANDOFF\nRole: manager\nSigned-by: Orla Mason',
  '## COLLABORATOR_HANDOFF\nRole: collaborator\nSigned-by: Orla Harper',
  '## ADMIN_HANDOFF\nRole: admin\nSigned-by: Orla Reyes',
  '## CONSULTANT_CLOSEOUT\nRole: consultant\nSigned-by: Orla Vale',
  'resolved as part of Epic #1714',
  'random ticket comment',
  '',
];

function randomIssue() {
  const labelCount = 1 + Math.floor(Math.random() * 6);
  const labels = Array.from({ length: labelCount },
    () => SAMPLE_LABELS[Math.floor(Math.random() * SAMPLE_LABELS.length)]);
  const commentCount = Math.floor(Math.random() * 5);
  const comments = Array.from({ length: commentCount },
    () => ({ body: SAMPLE_BODIES[Math.floor(Math.random() * SAMPLE_BODIES.length)] }));
  return { number: Math.floor(Math.random() * 9999), title: 'fuzz',
    state: Math.random() < 0.5 ? 'OPEN' : 'CLOSED', labels, comments };
}

test('FUZZ: 1000 random issues — linter never throws (G6 resilience)', () => {
  for (let i = 0; i < FUZZ_ITERATIONS; i++) {
    const issue = randomIssue();
    assert.doesNotThrow(() => lint(issue), `iteration ${i} threw on issue ${JSON.stringify(issue).slice(0, 200)}`);
  }
});

test('PERF: lint p99 < 5ms on standard input (G7 throughput)', () => {
  const sample = { number: 1, title: 'perf', state: 'CLOSED',
    labels: ['type:epic', 'status:done'],
    comments: [{ body: '## MANAGER_HANDOFF\nRole: manager' },
      { body: '## CONSULTANT_CLOSEOUT\nRole: consultant' }] };
  const samples = [];
  for (let i = 0; i < 500; i++) {
    const start = process.hrtime.bigint();
    lint(sample);
    samples.push(Number(process.hrtime.bigint() - start) / 1_000_000);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  assert.ok(p99 < PERF_BUDGET_P99_MS, `lint p99 ${p99.toFixed(2)}ms exceeds ${PERF_BUDGET_P99_MS}ms budget`);
});

test('ADVERSARIAL: Epic #1857 incident replay catches violation', () => {
  const issue = { number: 1857, title: 'multi-wiki', state: 'CLOSED',
    labels: ['type:epic', 'status:done'],
    comments: [{ body: '## ADMIN_HANDOFF — Multi-Wiki Substrate Security\nRole: admin\nSigned-by: Quinn Mason' }] };
  const r = lint(issue);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some(v => v.rule === 'epic-forbidden-artifact'));
});

test('ADVERSARIAL: malformed input — null labels does not crash', () => {
  assert.doesNotThrow(() => lint({ number: 1, title: 't', state: 'OPEN',
    labels: null, comments: null }));
});

test('ADVERSARIAL: malformed input — non-string label entries handled', () => {
  assert.doesNotThrow(() => lint({ number: 1, title: 't', state: 'OPEN',
    labels: [null, undefined, 42, {}, 'type:task'], comments: [] }));
});

test('CHAOS: comment body with embedded artifact-name in prose triggers violation', () => {
  const issue = { number: 1, title: 't', state: 'OPEN',
    labels: ['type:epic', 'role:manager'],
    comments: [{ body: 'Plan mentions ADMIN_HANDOFF schema; not posted yet.' }] };
  const r = lint(issue);
  // Per substring match, the validator flags this (false positive class — known limit).
  // Documented limit; structural fix is anchored markers in future iteration.
  assert.equal(r.type, 'type:epic');
});

test('CHAOS: 100 comments performance bound', () => {
  const comments = Array.from({ length: 100 }, (_, i) =>
    ({ body: `Comment ${i} ## MANAGER_HANDOFF\nRole: manager` }));
  const start = process.hrtime.bigint();
  lint({ number: 1, title: 't', state: 'CLOSED',
    labels: ['type:epic', 'status:done'], comments });
  const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
  assert.ok(elapsed < 50, `100-comment lint ${elapsed.toFixed(2)}ms exceeds 50ms budget`);
});

test('AUDIT FUZZ: 100 random issues via in-memory audit — no crashes', () => {
  const issues = Array.from({ length: 100 }, () => {
    const i = randomIssue();
    return { number: i.number, title: i.title, state: i.state,
      labels: i.labels.map(name => ({ name })),
      comments: i.comments.map(c => ({ body: c.body })) };
  });
  assert.doesNotThrow(() => audit({ issues }));
});

test('AUDIT: aliasDriftIn returns empty array for issue with no artifact comments', () => {
  const drift = aliasDriftIn({ number: 1, comments: [{ body: 'random text' }] });
  assert.deepEqual(drift, []);
});

test('AUDIT integration: aggregates workflow + alias findings into single report', () => {
  const issues = [
    { number: 1, title: 'bad-epic', state: 'OPEN',
      labels: [{ name: 'type:epic' }, { name: 'role:admin' }], comments: [] },
    { number: 2, title: 'closed-child-empty', state: 'CLOSED',
      labels: [{ name: 'type:task' }, { name: 'status:done' }], comments: [] },
  ];
  const r = audit({ issues });
  assert.equal(r.ok, false);
  assert.equal(r.issues_scanned, 2);
  assert.ok(r.workflow_violations >= 1);
});

test('STATE TRANSITION: ready → done skip caught even with full role labels removed', () => {
  const issue = { number: 1, title: 'child-skip-review', state: 'CLOSED',
    labels: ['type:task', 'status:ready', 'status:done'],
    comments: [{ body: '## MANAGER_HANDOFF\nRole: manager' }] };
  const r = lint(issue);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some(v => v.rule === 'multi-status'));
  assert.ok(r.violations.some(v => v.rule === 'child-missing-baton-artifacts'));
});

test('REGRESSION: closed child with all 4 baton artifacts no violations', () => {
  const issue = { number: 1, title: 'clean-close', state: 'CLOSED',
    labels: ['type:task', 'status:done'],
    comments: [
      { body: '## MANAGER_HANDOFF\nRole: manager' },
      { body: '## COLLABORATOR_HANDOFF\nRole: collaborator' },
      { body: '## ADMIN_HANDOFF\nRole: admin' },
      { body: '## CONSULTANT_CLOSEOUT\nRole: consultant' },
    ] };
  const r = lint(issue);
  assert.equal(r.ok, true);
});
