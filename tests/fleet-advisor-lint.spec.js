'use strict';
// tdd-pyramid unit tests for the Fleet Advisor Layer-① lint engine (Epic #3414 #3480).
// Goal alignment: G2 quality, G6 resilience (never-crash), G10 maintainability.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const engine = require('../scripts/global/fleet-advisor-lint.js');

const FIX_DIR = path.join(__dirname, 'fixtures', 'fleet-advisor');

/** Load a fixture and run the engine with a `now` that keeps fresh-telemetry fixtures fresh. */
function runFixture(name) {
  const fx = JSON.parse(fs.readFileSync(path.join(FIX_DIR, name), 'utf8'));
  const lastEmit = fx.probe.telemetry && fx.probe.telemetry.lastEmitMs;
  const now = lastEmit ? lastEmit + 1000 : 8 * 24 * 60 * 60 * 1000;
  return { fx, report: engine.runLint(fx.probe, { now }) };
}

test('AC1 — classifies all five tiers F0..F4 from synthetic fixtures', () => {
  for (const name of fs.readdirSync(FIX_DIR)) {
    const { fx, report } = runFixture(name);
    assert.equal(report.tier, fx.expectTier, `${name} tier`);
  }
  const tiers = fs.readdirSync(FIX_DIR).map((n) => runFixture(n).report.tier);
  for (const t of engine.TIER_ORDER) assert.ok(tiers.includes(t), `tier ${t} covered by a fixture`);
});

test('AC1 — a dead host is a finding, not a crash', () => {
  const report = engine.runLint({ hosts: [{ id: 'x', reachable: false }], cloud: { freeProvidersWired: false } }, { now: 1 });
  assert.equal(report.tier, 'F0');
  assert.ok(report.findings.some((f) => f.id === 'L-CLOUD-01'));
});

test('AC1 — never throws on malformed/empty/partial probes', () => {
  for (const bad of [undefined, null, {}, { hosts: null }, { hosts: [{}] }, { hosts: [{ reachable: true }] }]) {
    assert.doesNotThrow(() => engine.runLint(bad, { now: 1 }));
  }
});

test('degrade-safe — VRAM unknown steps F4 down to a lower tier and flags ambiguous', () => {
  const probe = { hosts: [{ id: 'a', reachable: true, gpu: {} }], dispatch: {}, cloud: { freeProvidersWired: true } };
  const report = engine.runLint(probe, { now: 1 });
  assert.ok(['F1'].includes(report.tier));
  assert.equal(report.ambiguous, true);
});

test('AC2 — fingerprint is collision-safe and stable across identical probes', () => {
  const { fx } = runFixture('f2-single-gpu.json');
  const a = engine.buildFingerprint(fx.probe);
  const b = engine.buildFingerprint(JSON.parse(JSON.stringify(fx.probe)));
  assert.equal(a.hash, b.hash);
  // a roster change must change the hash
  const mutated = JSON.parse(JSON.stringify(fx.probe));
  mutated.hosts[0].models.push({ name: 'new:7b', quant: 'Q4', sizeBytes: 1 });
  assert.notEqual(engine.buildFingerprint(mutated).hash, a.hash);
  // a keep_alive/dispatch change must change the hash
  const mutated2 = JSON.parse(JSON.stringify(fx.probe));
  mutated2.dispatch.keepAliveSet = !mutated2.dispatch.keepAliveSet;
  assert.notEqual(engine.buildFingerprint(mutated2).hash, a.hash);
});

test('AC3 — rule table is data: every rule declares tier-applicability, severity, class', () => {
  const { rules } = engine.loadRules();
  assert.ok(rules.length >= 14);
  for (const r of rules) {
    assert.ok(r.id && /^L-[A-Z]+-\d+$/.test(r.id), `rule id ${r.id}`);
    assert.ok(['high', 'med', 'low', 'informational'].includes(r.severity), `severity ${r.id}`);
    assert.ok(['IT-actionable', 'client', 'informational'].includes(r.class), `class ${r.id}`);
    assert.ok(r.tiers === '*' || Array.isArray(r.tiers), `tiers ${r.id}`);
    assert.ok(typeof r.signal === 'string' && r.signal.includes('.'), `signal ${r.id}`);
  }
});

test('findings are severity-ordered (high first)', () => {
  const { report } = runFixture('f2-single-gpu.json');
  const rank = { high: 0, med: 1, low: 2, informational: 3 };
  for (let i = 1; i < report.findings.length; i++) {
    assert.ok(rank[report.findings[i - 1].severity] <= rank[report.findings[i].severity]);
  }
});
