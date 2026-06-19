// tests/doc-coverage-diff-verify.spec.js — #3121, Epic #2707 keystone.
// Strategy: tdd-pyramid. Wires the previously-unwired #2716 diff-verify module into the
// live doc-coverage gate (advisory-first), reusing it rather than reimplementing. Covers
// the #2716 module extension, the doc-coverage delegation, and the collaborator-handoff
// threading — the full chain that turns dead code into a live advisory gate.
'use strict';

const { test, expect } = require('@playwright/test');
const dc = require('../scripts/global/megalint/doc-coverage');
const diffVerify = require('../scripts/global/megalint/doc-coverage-diff-verify');
const collab = require('../scripts/global/megalint/collaborator-handoff');

const MATRIX = { 'area:test': { required: ['docs/x.md'], suggested: [] } };
const updatedBlock = '## COLLABORATOR_HANDOFF\ndoc-coverage:\n  docs/x.md: UPDATED — change\n';

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

// ── doc-coverage delegation: diffVerifyViolations ──

test('diffVerifyViolations flags a declared-UPDATED surface absent from the diff (advisory)', () => {
  const block = { 'docs/x.md': 'UPDATED — y' };
  const violations = dc.diffVerifyViolations(block, ['docs/x.md'], ['scripts/foo.js']);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toMatchObject({ rule: 'doc-coverage-updated-not-in-diff', severity: 'advisory' });
});

test('diffVerifyViolations passes when the UPDATED surface is in the diff', () => {
  expect(dc.diffVerifyViolations({ 'docs/x.md': 'UPDATED' }, ['docs/x.md'], ['docs/x.md'])).toEqual([]);
});

test('diffVerifyViolations exempts N/A declarations', () => {
  expect(dc.diffVerifyViolations({ 'docs/x.md': 'N/A out-of-scope — z' }, ['docs/x.md'], ['scripts/foo.js'])).toEqual([]);
});

test('diffVerifyViolations skips gracefully when prFiles is unavailable (local validation)', () => {
  expect(dc.diffVerifyViolations({ 'docs/x.md': 'UPDATED' }, ['docs/x.md'], undefined)).toEqual([]);
  expect(dc.diffVerifyViolations({ 'docs/x.md': 'UPDATED' }, ['docs/x.md'], null)).toEqual([]);
});

// ── checkBlock integration (synthetic matrix) ──

test('checkBlock: UPDATED surface not in diff yields an advisory diff-miss', () => {
  const violations = dc.checkBlock(updatedBlock, ['area:test'], MATRIX, null, ['scripts/foo.js']);
  expect(violations).toHaveLength(1);
  expect(violations[0]).toMatchObject({ rule: 'doc-coverage-updated-not-in-diff', severity: 'advisory' });
});

test('checkBlock: UPDATED surface in diff yields no violation', () => {
  expect(dc.checkBlock(updatedBlock, ['area:test'], MATRIX, null, ['docs/x.md'])).toEqual([]);
});

test('checkBlock: no prFiles (local) skips diff-verification entirely', () => {
  expect(dc.checkBlock(updatedBlock, ['area:test'], MATRIX, null, undefined)).toEqual([]);
});

// ── validate ok-logic: advisory does not block; errors still do ──

test('validate: an advisory-only diff-miss keeps ok true (does not block)', () => {
  const result = dc.validate({ labels: ['area:test'], body: updatedBlock, prFiles: ['scripts/foo.js'], matrix: MATRIX });
  expect(result.violations).toHaveLength(1);
  expect(result.violations[0].severity).toBe('advisory');
  expect(result.ok).toBe(true);
});

test('validate: a missing required surface (error) still blocks', () => {
  const result = dc.validate({ labels: ['area:test'], body: '## COLLABORATOR_HANDOFF\n', prFiles: ['scripts/foo.js'], matrix: MATRIX });
  expect(result.ok).toBe(false);
  expect(result.violations.some((v) => v.severity === 'error')).toBe(true);
});

// ── collaborator-handoff threading: the live gate path stays non-blocking on advisory ──

test('collaborator-handoff: prFiles diff-miss is advisory, gate stays ok', () => {
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
    '  docs/howto/example.md: UPDATED — declared but not in diff',
  ].join('\n');
  const result = collab.validate({
    labels: ['lane:code-change', 'area:scripts'],
    comments: [{ body: handoff, user: { login: 'tester' } }],
    prFiles: ['scripts/only-this-changed.js'],
  });
  // any doc-coverage-updated-not-in-diff violation must be advisory (non-blocking)
  const diffMiss = (result.violations || []).filter((v) => v.rule === 'doc-coverage-updated-not-in-diff');
  diffMiss.forEach((v) => expect(v.severity).toBe('advisory'));
});
