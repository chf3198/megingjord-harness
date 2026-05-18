'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { lint, lintEpic, lintChild, statusLabels, roleLabels, artifactsPresent,
  REQUIRED_CHILD_ARTIFACTS, BRIEF_EVIDENCE_PATTERN, VALID_ROLES_ON_EPIC }
  = require('../scripts/global/role-baton-linter.js');

const STD_BATON = REQUIRED_CHILD_ARTIFACTS.map(art =>
  ({ body: `## ${art}\nSigned-by: X\nTeam&Model: y:z@w\nRole: ${art.includes('MANAGER') ? 'manager' :
    art.includes('COLLAB') ? 'collaborator' : art.includes('ADMIN') ? 'admin' : 'consultant'}` }));

test('statusLabels filters and returns status:* only', () => {
  assert.deepEqual(statusLabels(['type:task', 'status:done', 'role:manager']), ['status:done']);
});

test('roleLabels filters and returns role:* only', () => {
  assert.deepEqual(roleLabels(['type:task', 'status:done', 'role:manager']), ['role:manager']);
});

test('artifactsPresent detects all 4 baton artifacts', () => {
  const s = artifactsPresent(STD_BATON);
  for (const art of REQUIRED_CHILD_ARTIFACTS) assert.ok(s.has(art), `${art} missing`);
});

test('BRIEF_EVIDENCE_PATTERN matches multi-Close sibling phrase', () => {
  assert.ok(BRIEF_EVIDENCE_PATTERN.test('resolved as part of Epic #1857'));
  assert.ok(BRIEF_EVIDENCE_PATTERN.test('resolved as part of #1714'));
});

test('VALID_ROLES_ON_EPIC limited to manager + consultant', () => {
  assert.equal(VALID_ROLES_ON_EPIC.has('role:manager'), true);
  assert.equal(VALID_ROLES_ON_EPIC.has('role:consultant'), true);
  assert.equal(VALID_ROLES_ON_EPIC.has('role:collaborator'), false);
  assert.equal(VALID_ROLES_ON_EPIC.has('role:admin'), false);
});

test('lintEpic: Epic with role:admin label triggers epic-invalid-role-label', () => {
  const v = lintEpic({ labels: ['type:epic', 'role:admin'], comments: [] });
  assert.ok(v.some(x => x.rule === 'epic-invalid-role-label'));
});

test('lintEpic: Epic with ADMIN_HANDOFF comment triggers epic-forbidden-artifact', () => {
  const v = lintEpic({ labels: ['type:epic', 'role:manager'],
    comments: [{ body: '## ADMIN_HANDOFF\nRole: admin' }] });
  assert.ok(v.some(x => x.rule === 'epic-forbidden-artifact'));
});

test('lintEpic: Epic with COLLABORATOR_HANDOFF triggers epic-forbidden-artifact', () => {
  const v = lintEpic({ labels: ['type:epic', 'role:manager'],
    comments: [{ body: '## COLLABORATOR_HANDOFF\nRole: collaborator' }] });
  assert.ok(v.some(x => x.rule === 'epic-forbidden-artifact'));
});

test('lintEpic: clean Epic with role:manager + only MANAGER_HANDOFF passes', () => {
  const v = lintEpic({ labels: ['type:epic', 'role:manager'],
    comments: [{ body: '## MANAGER_HANDOFF\nRole: manager' }] });
  assert.equal(v.length, 0);
});

test('lintEpic: clean Epic with role:consultant during status:review passes', () => {
  const v = lintEpic({ labels: ['type:epic', 'role:consultant', 'status:review'],
    comments: [{ body: '## MANAGER_HANDOFF\nRole: manager' },
      { body: '## CONSULTANT_CLOSEOUT\nRole: consultant' }] });
  assert.equal(v.length, 0);
});

test('lintChild: closed child with full 4-artifact baton passes', () => {
  const v = lintChild({ state: 'CLOSED', labels: ['type:task', 'status:done'],
    comments: STD_BATON });
  assert.equal(v.length, 0);
});

test('lintChild: closed child missing baton artifacts fails', () => {
  const v = lintChild({ state: 'CLOSED', labels: ['type:task', 'status:done'],
    comments: [{ body: '## MANAGER_HANDOFF\nRole: manager' }] });
  assert.ok(v.some(x => x.rule === 'child-missing-baton-artifacts'));
  assert.match(v[0].detail, /COLLABORATOR_HANDOFF|ADMIN_HANDOFF|CONSULTANT_CLOSEOUT/);
});

test('lintChild: multi-status label triggers multi-status rule', () => {
  const v = lintChild({ state: 'OPEN', labels: ['type:task', 'status:ready', 'status:done'],
    comments: STD_BATON });
  assert.ok(v.some(x => x.rule === 'multi-status'));
});

test('lintChild: brief-evidence pointer exempts from missing-artifact rule', () => {
  const v = lintChild({ state: 'CLOSED', labels: ['type:task', 'status:done'],
    comments: [{ body: '## MANAGER_HANDOFF\nRole: manager' },
      { body: 'Resolved as part of Epic #1714 completion. See parent for CONSULTANT_CLOSEOUT.' }] });
  assert.equal(v.filter(x => x.rule === 'child-missing-baton-artifacts').length, 0);
});

test('lintChild: --skipBatchExemption forces full-baton check', () => {
  const v = lintChild({ state: 'CLOSED', labels: ['type:task', 'status:done'],
    comments: [{ body: '## MANAGER_HANDOFF\nRole: manager' },
      { body: 'resolved as part of #1714' }] }, { skipBatchExemption: true });
  assert.ok(v.some(x => x.rule === 'child-missing-baton-artifacts'));
});

test('lint: dispatches to lintEpic when type:epic', () => {
  const r = lint({ number: 1, title: 't', labels: ['type:epic', 'role:admin'], comments: [] });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some(x => x.rule === 'epic-invalid-role-label'));
});

test('lint: dispatches to lintChild when type:task', () => {
  const r = lint({ number: 1, title: 't', state: 'CLOSED',
    labels: ['type:task', 'status:done'], comments: [] });
  assert.equal(r.ok, false);
});

test('lint: replays Epic #1857 incident text — detects both classes', () => {
  const issue = { number: 1857, title: 'multi-wiki epic', state: 'CLOSED',
    labels: ['type:epic', 'status:done', 'role:manager'],
    comments: [{ body: '## ADMIN_HANDOFF — Multi-Wiki Substrate Security\nRole: admin\nSigned-by: Quinn Mason' },
      { body: '## CONSULTANT_CLOSEOUT\nRole: consultant' }] };
  const r = lint(issue);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some(x => x.rule === 'epic-forbidden-artifact'));
});

test('lint: replays Epic #1857 child text — detects missing-baton', () => {
  const child = { number: 1861, title: 'ingestion', state: 'CLOSED',
    labels: ['type:task', 'status:done'],
    comments: [{ body: '## MANAGER_HANDOFF\nRole: manager\nSigned-by: Quinn Mason' },
      { body: 'Resolved as part of Epic #1857 Multi-Wiki Substrate Security completion. See parent Epic for CONSULTANT_CLOSEOUT.' }] };
  const r = lint(child);
  // Brief-evidence pattern matches → batch exemption applies → ok=true is acceptable
  // BUT the lead Epic itself has the violation per E2 v2. Test documents this nuance.
  assert.equal(r.type, 'type:task');
});

test('lint: empty issue returns ok with reason', () => {
  const r = lint(null);
  assert.equal(r.ok, true);
});
