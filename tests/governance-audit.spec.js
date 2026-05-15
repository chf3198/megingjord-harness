// Governance audit productization tests (#837).
const { test, expect } = require('@playwright/test');
const path = require('path');
const A = require(path.resolve(__dirname, '..', 'scripts', 'global', 'governance-audit.js'));
const WorkerSignature = require(path.resolve(__dirname, '..', 'scripts', 'global', 'worker-signature-governance.js'));

test('CHECKS list includes the 4 deterministic governance scripts', () => {
  expect(A.CHECKS).toContain('governance:drift');
  expect(A.CHECKS).toContain('governance:verify');
  expect(A.CHECKS).toContain('governance:reconcile');
  expect(A.CHECKS).toContain('governance:worktrees');
});

test('detectViolations flags non-Epic backlog with role', () => {
  const v = A.detectViolations([
    { number: 1, labels: ['type:task', 'status:backlog', 'role:manager'] },
  ]);
  expect(v.length).toBe(1);
  expect(v[0].rule).toBe('Rule 4');
});

test('detectViolations skips Epic backlog with role:manager', () => {
  const v = A.detectViolations([
    { number: 1, labels: ['type:epic', 'status:backlog', 'role:manager'] },
  ]);
  expect(v.length).toBe(0);
});

test('detectViolations flags Epic backlog WITHOUT role:manager', () => {
  const v = A.detectViolations([
    { number: 1, labels: ['type:epic', 'status:backlog'] },
  ]);
  expect(v.some(x => x.rule === 'Rule E2')).toBe(true);
});

test('detectViolations flags in-progress missing collaborator (non-Epic)', () => {
  const v = A.detectViolations([
    { number: 1, labels: ['type:task', 'status:in-progress'] },
  ]);
  expect(v.some(x => x.rule === 'Rule 8')).toBe(true);
});

test('REPORT_FILE points at /tmp', () => {
  expect(A.REPORT_FILE).toBe('/tmp/governance-audit.json');
});

test('audit() returns schema_version 4 result with required fields', async () => {
  const r = await A.audit();
  expect(r.schema_version).toBe(4);
  expect(r).toHaveProperty('started_at');
  expect(r).toHaveProperty('checks');
  expect(r).toHaveProperty('violations');
  expect(r).toHaveProperty('git_state_drift');
  expect(r).toHaveProperty('dependency_health');
  expect(r).toHaveProperty('goal_health');
  expect(r).toHaveProperty('worker_signature_compliance');
  expect(r).toHaveProperty('actuator_state');
  expect(['PASS', 'FAIL']).toContain(r.overall);
});

test('audit() includes branch freshness, worktree isolation, and target integrity signals', async () => {
  const r = await A.audit();
  expect(r.git_state_drift).toBeTruthy();
  expect(r.git_state_drift.signals).toBeTruthy();
  expect(r.git_state_drift.signals.freshness).toBeTruthy();
  expect(r.git_state_drift.signals.worktree).toBeTruthy();
  expect(r.git_state_drift.signals.target).toBeTruthy();
});


test('dependency cycles become governance audit violations', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-dep-'));
  const graph = path.join(tmp, 'graph.json');
  fs.writeFileSync(graph, JSON.stringify({ nodes: [{ id: 1 }, { id: 2 }],
    edges: [{ from: 1, to: 2 }, { from: 2, to: 1 }] }));
  const r = await A.audit({ dependencyHealth: { graph, proposals: graph, decisions: graph } });
  expect(r.violations.some(v => v.rule === 'dependency-cycle')).toBe(true);
});

test('worker signature governance flags invalid grammar and client identity misuse', () => {
  const badBody = `Manager: curtisfranks | GitHub Copilot (Claude Sonnet 4.6 @ github-copilot) | 2026-05-14\n\nSigned-by: Curtis Franks\nTeam&Model: copilot:claude-sonnet-4-6@github-copilot\nRole: manager`;
  const result = WorkerSignature.inspectBody(badBody);
  expect(result.ok).toBe(false);
  expect(result.violations.some(v => v.rule === 'role-prefix-as-provenance')).toBe(true);
  expect(result.violations.some(v => v.rule === 'client-identity-as-signer')).toBe(true);
});

test('worker signature governance accepts canonical worker blocks', () => {
  const goodBody = `Signed-by: Quill Mason\nTeam&Model: codex:gpt-5.4@codex-cli\nRole: manager`;
  const result = WorkerSignature.inspectBody(goodBody);
  expect(result.ok).toBe(true);
  expect(result.violations).toHaveLength(0);
});
