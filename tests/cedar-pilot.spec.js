// Cedar pilot scaffolding tests per #1970.
// Lane: code-change. test_strategy: tdd-pyramid (MVP scaffolding only).

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const PILOT = require(path.resolve(__dirname, '..', 'scripts', 'global', 'cedar-pilot.js'));

test('loadPolicy returns Cedar policy text for signer-alias-canonical', () => {
  const text = PILOT.loadPolicy('signer-alias-canonical');
  expect(text).toMatch(/permit\s*\(/);
  expect(text).toMatch(/forbid\s*\(/);
  expect(text).toMatch(/signer-alias-canonical|signer/i);
});

test('Cedar policy file has permit + at least 2 forbid rules', () => {
  const text = PILOT.loadPolicy('signer-alias-canonical');
  const permitCount = (text.match(/^permit\s*\(/gm) || []).length;
  const forbidCount = (text.match(/^forbid\s*\(/gm) || []).length;
  expect(permitCount).toBeGreaterThanOrEqual(1);
  expect(forbidCount).toBeGreaterThanOrEqual(2);
});

test('loadCorpus returns ≥3 fixtures (MVP scaffold; full ≥100 deferred)', () => {
  const corpus = PILOT.loadCorpus();
  expect(corpus.length).toBeGreaterThanOrEqual(3);
});

test('validateFixture detects missing required keys', () => {
  const bad = { id: 'x' };
  const v = PILOT.validateFixture(bad);
  expect(v.ok).toBe(false);
  expect(v.missing).toContain('principal');
});

test('every fixture in corpus has required keys', () => {
  const corpus = PILOT.loadCorpus();
  for (const f of corpus) {
    const v = PILOT.validateFixture(f);
    expect.soft(v.ok, `${f.id} missing: ${v.missing.join(', ')}`).toBe(true);
  }
});

test('replayEval returns aggregate parity + skeleton status flag', () => {
  const report = PILOT.replayEval();
  expect(report.total).toBeGreaterThanOrEqual(3);
  expect(report.parity_pct).toBeGreaterThanOrEqual(0);
  expect(report.pilot_phase).toBe('mvp-scaffolding');
  expect(report.full_eval_status).toBe('deferred-to-phase-2');
});

test('evaluateJs + evaluateCedar both return runtime+decision keys', () => {
  const fixture = PILOT.loadCorpus()[0];
  const jsResult = PILOT.evaluateJs(fixture);
  const cedarResult = PILOT.evaluateCedar(fixture);
  expect(jsResult.runtime).toBeDefined();
  expect(jsResult.decision).toBeDefined();
  expect(cedarResult.runtime).toBeDefined();
  expect(cedarResult.decision).toBeDefined();
});

test('comparison report file exists with both substrates documented', () => {
  const reportPath = path.resolve(__dirname, '..', 'research', 'policy-substrate-comparison-2026.md');
  expect(fs.existsSync(reportPath)).toBe(true);
  const text = fs.readFileSync(reportPath, 'utf8');
  expect(text).toMatch(/Cedar/);
  expect(text).toMatch(/Microsoft|MS Toolkit/);
  expect(text).toMatch(/Phase-2/);
});

test('cedar policy declares signer-independence forbid rule', () => {
  const text = PILOT.loadPolicy('signer-alias-canonical');
  expect(text).toMatch(/admin.*collab_signed_by|signed_by.*collab/i);
});
