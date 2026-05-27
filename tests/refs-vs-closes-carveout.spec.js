// Tests for Option C deferred-finalize carve-out (Epic #2295 P1.3, #2303).
// Covers: deferred-finalize marker accepted, Closes-keyword backward-compat,
// both markers together, neither present (fail), lightweight-lane skip.
'use strict';

const { test, expect } = require('@playwright/test');
const gate = require('../scripts/global/megalint/merge-evidence-pr-gate');

const ctx = (overrides = {}) => ({
  labels: ['type:task', 'lane:code-change'],
  issueNumber: 2303,
  prBody: '',
  ...overrides,
});

// --- deferred-finalize marker (new preferred form) ---

test('#2303 AC1: deferred-finalize marker alone passes the gate', () => {
  const result = gate.validate(ctx({
    prBody: 'Refs #2303\n\nmerge-evidence-deferred-final: #2303',
  }));
  expect(result.ok).toBe(true);
  expect(result.closeTargets).toContain(2303);
});

test('#2303 AC1: deferred-finalize marker is case-insensitive for the keyword', () => {
  const result = gate.validate(ctx({
    prBody: 'MERGE-EVIDENCE-DEFERRED-FINAL: #2303',
  }));
  expect(result.ok).toBe(true);
});

test('#2303 AC1: deferred-finalize with extra whitespace around # passes', () => {
  const result = gate.validate(ctx({
    prBody: 'merge-evidence-deferred-final:  #2303',
  }));
  expect(result.ok).toBe(true);
});

test('#2303 AC1: deferred-finalize for wrong issue does not satisfy linked issue', () => {
  const result = gate.validate(ctx({
    prBody: 'merge-evidence-deferred-final: #9999',
  }));
  expect(result.ok).toBe(false);
  expect(result.violations[0].rule).toBe('merge-evidence-pr-gate-missing');
});

// --- Closes-keyword backward compat ---

test('#2303 AC5 (backward-compat): Closes #N alone still passes', () => {
  const result = gate.validate(ctx({ prBody: 'Refs #2303\nCloses #2303' }));
  expect(result.ok).toBe(true);
});

test('#2303 AC5 (backward-compat): Fixes / Resolves variants still pass', () => {
  for (const kw of ['Fixes', 'Fixed', 'Resolves', 'Resolved']) {
    expect(gate.validate(ctx({ prBody: `${kw} #2303` })).ok).toBe(true);
  }
});

// --- Both markers together ---

test('#2303 AC1+AC5: both deferred-finalize and Closes present passes', () => {
  const result = gate.validate(ctx({
    prBody: 'merge-evidence-deferred-final: #2303\nCloses #2303',
  }));
  expect(result.ok).toBe(true);
  expect(result.closeTargets).toContain(2303);
});

// --- Neither marker present (must fail with updated message) ---

test('#2303 AC1: neither marker present fails with message citing both options', () => {
  const result = gate.validate(ctx({ prBody: 'Refs #2303\n\nNo evidence marker here.' }));
  expect(result.ok).toBe(false);
  const detail = result.violations[0].detail;
  expect(detail).toMatch(/merge-evidence-deferred-final/);
  expect(detail).toMatch(/Closes #2303/);
  expect(result.violations[0].issueNumber).toBe(2303);
});

// --- Lightweight-lane labels still skip gate ---

test('#2303: lightweight lanes skip the gate regardless of body', () => {
  for (const lane of ['lane:docs-research', 'lane:docs-only', 'lane:trivial', 'lane:research']) {
    const result = gate.validate(ctx({ labels: ['type:task', lane], prBody: '' }));
    expect(result.ok, `lane=${lane}`).toBe(true);
    expect(result.skipped).toBe(`lightweight-lane:${lane}`);
  }
});

// --- DEFERRED_FINAL_RE exported for consumers ---

test('#2303: DEFERRED_FINAL_RE is exported and matches the marker pattern', () => {
  expect(gate.DEFERRED_FINAL_RE).toBeDefined();
  const re = new RegExp(gate.DEFERRED_FINAL_RE.source, gate.DEFERRED_FINAL_RE.flags);
  expect('merge-evidence-deferred-final: #42'.match(re)).not.toBeNull();
  expect('Closes #42'.match(re)).toBeNull();
});

// --- findCloseTargets combines both sources ---

test('#2303: findCloseTargets returns union of Closes-keyword and deferred-finalize targets', () => {
  const targets = gate.findCloseTargets(
    'Closes #100\nmerge-evidence-deferred-final: #200',
  );
  expect(targets.has(100)).toBe(true);
  expect(targets.has(200)).toBe(true);
});
