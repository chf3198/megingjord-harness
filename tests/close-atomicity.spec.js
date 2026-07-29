'use strict';
// Epic #3576 W-C (#3582) — close-atomicity gate (E10) + batched builder.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const g = require(path.resolve(__dirname, '../scripts/global/close-atomicity-gate'));
const builder = require(path.resolve(__dirname, '../scripts/global/baton-artifact-builder'));

const TERMINAL = { issueState: 'CLOSED', labels: ['status:done'], openBatonBack: false };

test('isTerminal: CLOSED + status:done + no role + no baton-back = ok', () => {
  expect(g.isTerminal(TERMINAL).ok).toBe(true);
});
test('isTerminal: OPEN is not terminal', () => {
  expect(g.isTerminal({ issueState: 'OPEN', labels: ['status:done'] }).ok).toBe(false);
});
test('isTerminal: lingering role label is not terminal', () => {
  expect(g.isTerminal({ issueState: 'CLOSED', labels: ['status:done', 'role:consultant'] }).ok).toBe(false);
});
test('isTerminal: open baton-back blocks terminal', () => {
  expect(g.isTerminal({ ...TERMINAL, openBatonBack: true }).ok).toBe(false);
});
test('completionClaimGuard: done-claim on OPEN state is blocked (open-done race)', () => {
  const r = g.completionClaimGuard('W-X complete and closed', { issueState: 'OPEN', labels: ['status:review'] });
  expect(r.blocked).toBe(true); expect(r.reason).toBe('open-done-race');
});
test('completionClaimGuard: done-claim on terminal state passes', () => {
  expect(g.completionClaimGuard('done', TERMINAL).blocked).toBe(false);
});
test('completionClaimGuard: non-claim text never blocks', () => {
  expect(g.completionClaimGuard('still in progress', { issueState: 'OPEN' }).blocked).toBe(false);
});
test('buildArtifactSet: emits multiple artifacts in one call', () => {
  const out = builder.buildArtifactSet([
    { artifact: 'MANAGER_HANDOFF', role: 'manager', teamModel: 'claude-code:claude-opus-4-8@local',
      fields: { scope: 'x', lane: 'lane:code-change', test_strategy: 'tdd-pyramid', acceptance: '- a',
        gates: 'g', related_tickets: '#1', overlap_decision: 'none' } },
    { artifact: 'EPIC_RESCOPE', role: 'manager', teamModel: 'claude-code:claude-opus-4-8@local',
      fields: { summary: 'rescoped' } },
  ]);
  expect(out.length).toBe(2);
  expect(out[0].artifact).toBe('MANAGER_HANDOFF');
  expect(out[0].body).toContain('## MANAGER_HANDOFF');
  expect(out[1].body).toContain('## EPIC_RESCOPE');
});
