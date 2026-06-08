'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const ci = require(path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'chain-integrity.js'));

const REPO = path.resolve(__dirname, '..');

test('the shipped registry validates clean', () => {
  const registry = yaml.load(fs.readFileSync(path.join(REPO, 'config/governance-chains.yml'), 'utf8'));
  const result = ci.validate(registry, { repoRoot: REPO });
  assert.deepStrictEqual(result.violations, [], JSON.stringify(result.violations));
  assert.strictEqual(result.ok, true);
});

test('a discretionary link is rejected', () => {
  const reg = { governance_surface: ['config/governance-chains.yml'],
    chains: { x: [{ link: 'l', guarantee: 'operator-discretionary', enforcement_point: 'config/governance-chains.yml' }] } };
  const result = ci.validate(reg, { repoRoot: REPO });
  assert.strictEqual(result.ok, false);
  assert.ok(result.violations.some((v) => v.rule === 'discretionary-or-invalid-guarantee'));
});

test('a phantom enforcement_point is rejected', () => {
  const reg = { governance_surface: ['config/governance-chains.yml'],
    chains: { x: [{ link: 'l', guarantee: 'enforced', enforcement_point: 'scripts/does-not-exist.js' }] } };
  assert.ok(ci.checkEnforcementPoints(reg.chains, REPO).some((v) => v.rule === 'phantom-enforcement-point'));
});

test('touching a governed surface without a registry delta is rejected', () => {
  const out = ci.checkSurfaceDelta(['hooks/scripts/pretool_guard.py'], ['hooks/scripts/**'], false);
  assert.ok(out.some((v) => v.rule === 'surface-touched-without-registry-delta'));
});

test('touching a surface WITH a registry delta passes', () => {
  const out = ci.checkSurfaceDelta(['hooks/scripts/pretool_guard.py'], ['hooks/scripts/**'], true);
  assert.deepStrictEqual(out, []);
});

test('a registry that omits itself from governance_surface is rejected', () => {
  assert.ok(ci.checkSelfProtection(['hooks/scripts/**']).some((v) => v.rule === 'registry-not-self-protected'));
});

test('a policy downgrade in added diff lines is flagged (Signal C)', () => {
  const diff = '-  failurePolicy: Fail\n+  failurePolicy: Ignore\n';
  assert.ok(ci.scanWeakening(diff).some((v) => v.rule === 'failurepolicy-downgrade'));
});
