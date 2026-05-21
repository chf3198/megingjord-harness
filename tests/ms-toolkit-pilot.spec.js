// MS Toolkit pilot scaffolding tests per #1988.
// Lane: code-change. test_strategy: tdd-pyramid (MVP scaffolding only).

const { test, expect } = require('@playwright/test');
const path = require('path');
const PILOT = require(path.resolve(__dirname, '..', 'scripts', 'global', 'ms-toolkit-pilot.js'));

test('TOOLKIT_PACKAGE points to canonical @microsoft/agentmesh-sdk', () => {
  expect(PILOT.TOOLKIT_PACKAGE).toBe('@microsoft/agentmesh-sdk');
});

test('TOOLKIT_LICENSE is MIT (G3-friendly)', () => {
  expect(PILOT.TOOLKIT_LICENSE).toBe('MIT');
});

test('shared replay corpus loaded from cedar-replay dir', () => {
  const corpus = PILOT.loadCorpus();
  expect(corpus.length).toBeGreaterThanOrEqual(3);
});

test('buildPolicyDescriptor declares Agent OS runtime + p99 target ≤0.1ms', () => {
  const d = PILOT.buildPolicyDescriptor();
  expect(d.runtime).toBe('agent-os');
  expect(d.p99_target_ms).toBeLessThanOrEqual(0.1);
});

test('descriptor lists permit + forbid rules', () => {
  const d = PILOT.buildPolicyDescriptor();
  expect(d.permit_rules.length).toBeGreaterThanOrEqual(1);
  expect(d.forbid_rules.length).toBeGreaterThanOrEqual(2);
});

test('evaluateMs returns runtime+decision keys (skeleton)', () => {
  const result = PILOT.evaluateMs({});
  expect(result.runtime).toBe('ms-toolkit-skeleton');
  expect(result.decision).toBeDefined();
});

test('replayEval cites sibling pilot #1970 + flags MVP phase', () => {
  const report = PILOT.replayEval();
  expect(report.sibling_pilot).toMatch(/#1970/);
  expect(report.pilot_phase).toBe('mvp-scaffolding');
  expect(report.full_eval_status).toBe('deferred-to-phase-2');
});

test('descriptor notes OWASP coverage (OA2/OA3/OA6 enforced)', () => {
  const d = PILOT.buildPolicyDescriptor();
  expect(d.notes).toMatch(/OA\d/);
});
