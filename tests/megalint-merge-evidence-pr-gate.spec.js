// Tests for scripts/global/megalint/merge-evidence-pr-gate.js (Epic #1486 Phase-1c, #1506).
const { test, expect } = require('@playwright/test');
const gate = require('../scripts/global/megalint/merge-evidence-pr-gate');

const ctx = (overrides = {}) => ({
  labels: ['type:task', 'lane:code-change'],
  issueNumber: 1506,
  prBody: '',
  ...overrides,
});

test('#1506 AC1: passes when PR body cites "Closes #N" for the linked issue', () => {
  const result = gate.validate(ctx({ prBody: 'Implements the gate.\n\nCloses #1506' }));
  expect(result.ok).toBe(true);
  expect(result.closeTargets).toContain(1506);
});

test('#1506 AC1: accepts Fixes / Resolves / Close / Fix / Resolve / Closed / Fixed / Resolved variants', () => {
  for (const keyword of ['Closes', 'Close', 'Closed', 'Fixes', 'Fix', 'Fixed', 'Resolves', 'Resolve', 'Resolved']) {
    const result = gate.validate(ctx({ prBody: `${keyword} #1506` }));
    expect(result.ok, `keyword=${keyword}`).toBe(true);
  }
});

test('#1506 AC1: keyword matching is case-insensitive', () => {
  for (const variant of ['closes', 'CLOSES', 'cLoSeS', 'FIXES', 'resolves']) {
    expect(gate.validate(ctx({ prBody: `${variant} #1506` })).ok).toBe(true);
  }
});

test('#1506 AC1: fails when PR body lacks any auto-close keyword for the linked issue', () => {
  const result = gate.validate(ctx({ prBody: 'Refs #1506\n\nNo close keyword present.' }));
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('merge-evidence-pr-gate-missing');
  expect(result.violations[0].issueNumber).toBe(1506);
});

test('#1506 AC1: fails when PR closes wrong issue (multi-issue PR mismatch)', () => {
  const result = gate.validate(ctx({ prBody: 'Closes #1499\nCloses #1503' }));
  expect(result.ok).toBe(false);
  expect(result.violations[0].closeTargetsFound).toEqual(expect.arrayContaining([1499, 1503]));
});

test('#1506 AC1: passes when PR closes multiple issues including the linked one', () => {
  const result = gate.validate(ctx({ prBody: 'Closes #1499\nCloses #1506\nRefs #1486' }));
  expect(result.ok).toBe(true);
  expect(result.closeTargets).toEqual(expect.arrayContaining([1499, 1506]));
});

test('#1506 AC3: lightweight lanes skip the gate', () => {
  for (const lane of ['lane:docs-research', 'lane:docs-only', 'lane:trivial', 'lane:research', 'lane:no-code-remediation']) {
    const result = gate.validate(ctx({ labels: ['type:task', lane], prBody: '' }));
    expect(result.ok, `lane=${lane}`).toBe(true);
    expect(result.skipped).toBe(`lightweight-lane:${lane}`);
  }
});

test('#1506 AC4: type:epic issues skip the gate', () => {
  const result = gate.validate(ctx({ labels: ['type:epic', 'lane:code-change'], prBody: '' }));
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('epic-bypass');
});

test('#1506 AC5: override label suppresses the gate', () => {
  const result = gate.validate(ctx({
    labels: ['type:task', 'lane:code-change', 'merge-evidence-override:approved'],
    prBody: '',
  }));
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('override-approved');
});

test('#1506: missing issueNumber returns skip (no-op, not error)', () => {
  const result = gate.validate({ labels: ['lane:code-change'], prBody: 'some body' });
  expect(result.ok).toBe(true);
  expect(result.skipped).toBe('no-issue-context');
});

test('#1506: findCloseTargets returns empty Set for empty/null body', () => {
  expect(gate.findCloseTargets('').size).toBe(0);
  expect(gate.findCloseTargets(null).size).toBe(0);
  expect(gate.findCloseTargets(undefined).size).toBe(0);
});

test('#1506 AC2: registered in megalint VALIDATORS map', () => {
  const megalint = require('../scripts/global/megalint');
  expect(megalint.VALIDATORS).toHaveProperty('merge-evidence-pr-gate');
  const result = megalint.run('merge-evidence-pr-gate', ctx({ prBody: 'Closes #1506' }));
  expect(result.ok).toBe(true);
});

test('#1506: runAll() includes the new validator in aggregated results', () => {
  const megalint = require('../scripts/global/megalint');
  const result = megalint.runAll({
    ...ctx({ prBody: 'Closes #1506' }),
    comments: [], state: 'open', body: '## ACs\n- [x] AC1', ticketRef: '#1506',
  });
  expect(result.results).toHaveProperty('merge-evidence-pr-gate');
  expect(result.results['merge-evidence-pr-gate'].ok).toBe(true);
});
