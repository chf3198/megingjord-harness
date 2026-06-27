// tests/doc-coverage-diff-verify.spec.js — #3121 keystone, #3122 promotion.
// Strategy: tdd-pyramid. Wires the #2716 diff-verify module into the live doc-coverage
// gate. #3121 shipped it advisory-first; #3122 PROMOTES the diff-membership check to
// blocking (severity error) once replay-eval precision reaches the floor, with the
// DOC_COVERAGE_DIFF_BLOCKING_DISABLED env kill-switch reverting it to advisory.
'use strict';

const { test, expect } = require('@playwright/test');
const dc = require('../scripts/global/megalint/doc-coverage');
const diffVerify = require('../scripts/global/megalint/doc-coverage-diff-verify');
const reval = require('../scripts/global/megalint/doc-coverage-diff-replay-eval');
const collab = require('../scripts/global/megalint/collaborator-handoff');

const MATRIX = { 'area:test': { required: ['docs/x.md'], suggested: [] } };
const updatedBlock = '## COLLABORATOR_HANDOFF\ndoc-coverage:\n  docs/x.md: UPDATED — change\n';
// A real, healthy in-repo doc surface so the wired structuralCheck (AC2) stays quiet.
const REAL = 'CHANGELOG.md';
const realMatrix = { 'area:test': { required: [REAL], suggested: [] } };
const realBlock = `## COLLABORATOR_HANDOFF\ndoc-coverage:\n  ${REAL}: UPDATED — change\n`;

// ── #2716 module: surfaceTouched boundary correctness ──

test('surfaceTouched matches an exact root file but not a sibling prefix', () => {
  expect(diffVerify.surfaceTouched('docs/x.md', ['docs/x.md'])).toBe(true);
  expect(diffVerify.surfaceTouched('docs', ['docs-other.md'])).toBe(false); // /-boundary guard
});

test('surfaceTouched matches a directory surface by path boundary', () => {
  expect(diffVerify.surfaceTouched('.changes/unreleased/', ['.changes/unreleased/3121.md'])).toBe(true);
  expect(diffVerify.surfaceTouched('wiki/wisdom/global/', ['wiki/wisdom/global/concepts/x.md'])).toBe(true);
});

// ── #2716 module: pre-fetched changedFiles (the #3121 extension) ──

test('verifyDeclaredSurfaces uses opts.changedFiles without a git base, structural off', () => {
  const miss = diffVerify.verifyDeclaredSurfaces(['docs/x.md'], null,
    { changedFiles: ['scripts/foo.js'], structural: false });
  expect(miss.violations.some((v) => v.rule === 'doc-diff-not-changed')).toBe(true);
  const hit = diffVerify.verifyDeclaredSurfaces(['docs/x.md'], null,
    { changedFiles: ['docs/x.md'], structural: false });
  expect(hit.violations).toEqual([]);
});

// ── doc-coverage delegation: diffVerifyViolations (#3122 blocking) ──

test('diffVerifyViolations BLOCKS a declared-UPDATED surface absent from the diff (#3122)', () => {
  reval._resetCache();
  const block = { 'docs/x.md': 'UPDATED — y' };
  const violations = dc.diffVerifyViolations(block, ['docs/x.md'], ['scripts/foo.js']);
  expect(violations).toHaveLength(1); // not-in-diff surface: structural check is skipped
  expect(violations[0]).toMatchObject({ rule: 'doc-coverage-updated-not-in-diff', severity: 'error' });
});

test('diffVerifyViolations kill-switch: absent surface stays advisory when blocking disabled', () => {
  reval._resetCache();
  process.env[reval.DISABLE_ENV] = '1';
  try {
    const violations = dc.diffVerifyViolations({ 'docs/x.md': 'UPDATED' }, ['docs/x.md'], ['scripts/foo.js']);
    expect(violations[0]).toMatchObject({ rule: 'doc-coverage-updated-not-in-diff', severity: 'advisory' });
  } finally { delete process.env[reval.DISABLE_ENV]; reval._resetCache(); }
});

test('diffVerifyViolations passes when the UPDATED surface is in the diff', () => {
  expect(dc.diffVerifyViolations({ [REAL]: 'UPDATED' }, [REAL], [REAL])).toEqual([]);
});

test('diffVerifyViolations exempts N/A declarations', () => {
  expect(dc.diffVerifyViolations({ 'docs/x.md': 'N/A out-of-scope — z' }, ['docs/x.md'], ['scripts/foo.js'])).toEqual([]);
});

test('diffVerifyViolations skips gracefully when prFiles is unavailable (local validation)', () => {
  expect(dc.diffVerifyViolations({ 'docs/x.md': 'UPDATED' }, ['docs/x.md'], undefined)).toEqual([]);
  expect(dc.diffVerifyViolations({ 'docs/x.md': 'UPDATED' }, ['docs/x.md'], null)).toEqual([]);
});

// ── checkBlock integration (synthetic matrix) ──

test('checkBlock: UPDATED surface not in diff yields a blocking diff-miss (#3122)', () => {
  reval._resetCache();
  const violations = dc.checkBlock(updatedBlock, ['area:test'], MATRIX, null, ['scripts/foo.js']);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toMatchObject({ rule: 'doc-coverage-updated-not-in-diff', severity: 'error' });
});

test('checkBlock: UPDATED surface in diff yields no violation', () => {
  expect(dc.checkBlock(realBlock, ['area:test'], realMatrix, null, [REAL])).toEqual([]);
});

test('checkBlock: no prFiles (local) skips diff-verification entirely', () => {
  expect(dc.checkBlock(updatedBlock, ['area:test'], MATRIX, null, undefined)).toEqual([]);
});

// ── validate ok-logic: promoted diff-miss blocks; kill-switch reverts to advisory ──

test('validate: a promoted diff-miss BLOCKS (ok false) (#3122)', () => {
  reval._resetCache();
  const result = dc.validate({ labels: ['area:test'], body: updatedBlock, prFiles: ['scripts/foo.js'], matrix: MATRIX });
  expect(result.violations).toHaveLength(1);
  expect(result.violations[0].severity).toBe('error');
  expect(result.ok).toBe(false);
});

test('validate: kill-switch reverts diff-miss to advisory, ok true', () => {
  reval._resetCache();
  process.env[reval.DISABLE_ENV] = '1';
  try {
    const result = dc.validate({ labels: ['area:test'], body: updatedBlock, prFiles: ['scripts/foo.js'], matrix: MATRIX });
    expect(result.violations[0].severity).toBe('advisory');
    expect(result.ok).toBe(true);
  } finally { delete process.env[reval.DISABLE_ENV]; reval._resetCache(); }
});

test('validate: a missing required surface (error) still blocks', () => {
  const result = dc.validate({ labels: ['area:test'], body: '## COLLABORATOR_HANDOFF\n', prFiles: ['scripts/foo.js'], matrix: MATRIX });
  expect(result.ok).toBe(false);
  expect(result.violations.some((v) => v.severity === 'error')).toBe(true);
});

// ── collaborator-handoff threading: the live gate path now blocks on a diff-miss ──

test('collaborator-handoff: prFiles diff-miss BLOCKS the gate (#3122)', () => {
  reval._resetCache();
  const handoff = [
    '## COLLABORATOR_HANDOFF',
    'Signed-by: Orla Harper',
    'Team&Model: claude-code:opus@local',
    'Role: collaborator',
    'test_strategy: tdd-pyramid',
    'cross_family_rating: 9/10',
    'cross_family_reviewer: qwen:32b@fleet',
    'cross_family_findings: ok',
    'doc-coverage:',
    '  README.md: UPDATED — declared but not in diff',
    '  .changes/unreleased/: N/A out-of-scope',
    '  docs/howto/: N/A out-of-scope',
  ].join('\n');
  const result = collab.validate({
    labels: ['lane:code-change', 'area:scripts'],
    comments: [{ body: handoff, user: { login: 'tester' } }],
    prFiles: ['scripts/only-this-changed.js'],
  });
  const diffMiss = (result.violations || []).filter((v) => v.rule === 'doc-coverage-updated-not-in-diff');
  expect(diffMiss.length).toBeGreaterThan(0);
  diffMiss.forEach((v) => expect(v.severity).toBe('error'));
});
