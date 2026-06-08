'use strict';
// Stress (Epic #2709 / #2721): adversarial-input parser → fault-injection + p99 budget.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ci = require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'chain-integrity.js'));

const SURFACE = ['config/governance-chains.yml'];
const P99_BUDGET_MS = 250;
const SCALE = 2000;

test('chaos: malformed / missing-field links never throw, always classify', () => {
  const chaos = { governance_surface: SURFACE, chains: {
    a: [{ link: 'ok', guarantee: 'enforced', enforcement_point: 'config/governance-chains.yml' }],
    b: [{ link: 'no-guarantee', enforcement_point: 'config/governance-chains.yml' }],
    c: [{ guarantee: null, enforcement_point: null }],
    d: [{}],
    e: null,
  } };
  const result = ci.validate(chaos, { repoRoot: path.resolve(__dirname, '..') });
  assert.strictEqual(result.ok, false);
  // every malformed link surfaces as a guarantee violation, none crash the parser
  assert.ok(result.violations.filter((v) => v.rule === 'discretionary-or-invalid-guarantee').length >= 3);
});

test('perf: validating a large registry stays under the p99 budget', () => {
  const chains = {};
  for (let i = 0; i < SCALE; i += 1) {
    chains[`chain${i}`] = [{ link: `l${i}`, guarantee: 'auto-emitted', enforcement_point: 'config/governance-chains.yml' }];
  }
  const registry = { governance_surface: SURFACE, chains };
  const start = process.hrtime.bigint();
  const result = ci.validate(registry, { repoRoot: path.resolve(__dirname, '..') });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.strictEqual(result.ok, true);
  assert.ok(elapsedMs < P99_BUDGET_MS, `validate took ${elapsedMs}ms (budget ${P99_BUDGET_MS}ms)`);
});
