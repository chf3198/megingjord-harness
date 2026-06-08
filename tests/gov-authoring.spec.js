'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const check = require(path.resolve(__dirname, '..', 'scripts', 'global', 'gov-check.js'));
const scaffold = require(path.resolve(__dirname, '..', 'scripts', 'global', 'gov-scaffold-link.js'));

const REPO = path.resolve(__dirname, '..');

test('govHealth reports zero discretionary links for the shipped registry', () => {
  const health = check.govHealth(check.loadRegistry(REPO), { repoRoot: REPO });
  assert.strictEqual(health.ok, true);
  assert.strictEqual(health.discretionary_links, 0);
  assert.ok(health.links >= health.chains);
});

test('govHealth surfaces a discretionary link as a violation', () => {
  const bad = { governance_surface: ['config/governance-chains.yml'],
    chains: { x: [{ link: 'l', guarantee: 'operator-discretionary', enforcement_point: 'config/governance-chains.yml' }] } };
  const health = check.govHealth(bad, { repoRoot: REPO });
  assert.strictEqual(health.ok, false);
  assert.strictEqual(health.discretionary_links, 1);
});

test('scaffoldLink emits a compliant registry entry + guard stub', () => {
  const out = scaffold.scaffoldLink({ chain: 'demo', link: 'my-link',
    guarantee: 'enforced', enforcementPoint: 'scripts/global/foo.js' });
  assert.match(out.registryEntry, /guarantee: enforced/);
  assert.match(out.registryEntry, /enforcement_point: scripts\/global\/foo\.js/);
  assert.match(out.guardStub, /fail-closed/);
});

test('scaffoldLink refuses an operator-discretionary guarantee (poka-yoke at authoring)', () => {
  assert.throws(() => scaffold.scaffoldLink({ chain: 'c', link: 'l', guarantee: 'operator-discretionary' }),
    /not a legal link type/);
});

test('scaffoldLink requires chain and link', () => {
  assert.throws(() => scaffold.scaffoldLink({ guarantee: 'enforced' }), /required/);
});
