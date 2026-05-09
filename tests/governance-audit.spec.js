// Governance audit productization tests (#837).
const { test, expect } = require('@playwright/test');
const path = require('path');
const A = require(path.resolve(__dirname, '..', 'scripts', 'global', 'governance-audit.js'));

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

test('audit() returns schema_version 1 result with required fields', async () => {
  const r = await A.audit();
  expect(r.schema_version).toBe(1);
  expect(r).toHaveProperty('started_at');
  expect(r).toHaveProperty('checks');
  expect(r).toHaveProperty('violations');
  expect(r).toHaveProperty('dependency_health');
  expect(['PASS', 'FAIL']).toContain(r.overall);
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
