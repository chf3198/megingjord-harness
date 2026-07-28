'use strict';
// tests/gate-disposal-eval.spec.js — Epic #3807 C3 (#3811) gate disposal-path evaluator.
// tdd-pyramid: pure-function unit coverage of the disposition logic + the fail-safe defaults.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateValidator,
  evaluateAll,
  liveDominators,
  REVIEWED_REDUNDANCY,
  PRECISION_FLOOR,
  NOT_PROMOTED_WINDOW_FLOOR,
} = require('../scripts/global/gate-disposal-eval.js');

describe('gate-disposal-eval', () => {
  it('flags a reviewed-redundancy validator as a retirement-candidate (dominators live)', () => {
    // worktree-naming-advisory is retired; its registry entry is the audit record and its two
    // dominating BLOCKING gates still exist, so the disposition stays retirement-candidate.
    const result = evaluateValidator('worktree-naming-advisory.js');
    assert.strictEqual(result.disposition, 'retirement-candidate');
    assert.strictEqual(result.basis, 'reviewed-redundancy');
    assert.ok(result.reasons.join(' ').includes('validate-branch-name.sh'));
  });

  it('fail-safe: an advisory validator with no evidence defaults to retain', () => {
    const result = evaluateValidator('some-unknown-advisory.js');
    assert.strictEqual(result.disposition, 'retain');
    assert.strictEqual(result.basis, 'insufficient-evidence');
  });

  it('promotes when replay precision meets the floor', () => {
    const result = evaluateValidator('candidate.js', { precision: PRECISION_FLOOR, windows: 5 });
    assert.strictEqual(result.disposition, 'promotion-candidate');
    assert.strictEqual(result.basis, 'replay-precision');
  });

  it('retirement-candidate when below floor after enough windows (non-promoting)', () => {
    const result = evaluateValidator('stuck.js', { precision: 0.4, windows: NOT_PROMOTED_WINDOW_FLOOR });
    assert.strictEqual(result.disposition, 'retirement-candidate');
    assert.strictEqual(result.basis, 'below-floor-non-promoting');
  });

  it('retains a below-floor validator that has not yet had enough windows', () => {
    const result = evaluateValidator('early.js', { precision: 0.4, windows: NOT_PROMOTED_WINDOW_FLOOR - 1 });
    assert.strictEqual(result.disposition, 'retain');
  });

  it('reviewed redundancy outranks replay signal (redundancy is the stronger evidence)', () => {
    const result = evaluateValidator('worktree-naming-advisory.js', { precision: 0.99, windows: 9 });
    assert.strictEqual(result.disposition, 'retirement-candidate');
    assert.strictEqual(result.basis, 'reviewed-redundancy');
  });

  it('liveDominators drops a dominator that no longer exists on disk (no phantom redundancy)', () => {
    const entry = { dominatedBy: ['nonexistent/gate/path-does-not-exist.sh'] };
    assert.deepStrictEqual(liveDominators(entry), []);
    assert.deepStrictEqual(liveDominators({}), []);
  });

  it('the retirement audit record for worktree-naming-advisory is retained in the registry', () => {
    assert.ok(REVIEWED_REDUNDANCY['worktree-naming-advisory.js']);
    assert.strictEqual(REVIEWED_REDUNDANCY['worktree-naming-advisory.js'].ticket, '#3811');
  });

  it('evaluateAll returns only advisory validators, each with a valid disposition, and never a blocking gate', () => {
    const rows = evaluateAll();
    assert.ok(Array.isArray(rows));
    const valid = new Set(['retain', 'promotion-candidate', 'retirement-candidate']);
    for (const row of rows) assert.ok(valid.has(row.disposition), `bad disposition: ${row.disposition}`);
    // workflow-sha-pin is a blocking gate — it must never appear in the advisory disposition set.
    assert.ok(!rows.some((row) => row.validator === 'workflow-sha-pin.js'));
  });
});
