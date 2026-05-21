// OWASP coverage audit tests per #1987.
// Lane: code-change. test_strategy: tdd-pyramid.

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const AUDIT = require(path.resolve(__dirname, '..', 'scripts', 'global', 'owasp-coverage-audit.js'));

test('REQUIRED_RISKS lists OA1-OA10', () => {
  expect(AUDIT.REQUIRED_RISKS.length).toBe(10);
  expect(AUDIT.REQUIRED_RISKS).toContain('OA1');
  expect(AUDIT.REQUIRED_RISKS).toContain('OA10');
});

test('classify recognizes Enforced / Deferred / Advisory / Partial', () => {
  expect(AUDIT.classify('**Enforced** via x')).toBe('enforced');
  expect(AUDIT.classify('**Deferred** by goal-lens override')).toBe('deferred');
  expect(AUDIT.classify('Advisory (closeout evidence required)')).toBe('advisory');
  expect(AUDIT.classify('Partial (memory-watchdog)')).toBe('partial');
  expect(AUDIT.classify('something else entirely')).toBe('unknown');
});

test('parseRiskRows extracts each OA<N> row', () => {
  const md = [
    '| # | Risk | Goals | Coverage | Mitigation |',
    '| --- | --- | --- | --- | --- |',
    '| OA1 | Goal Hijacking | G1 | **Enforced** | mitigation |',
    '| OA2 | Tool Misuse | G1 | **Enforced** | mitigation |',
  ].join('\n');
  const rows = AUDIT.parseRiskRows(md);
  expect(Object.keys(rows)).toContain('OA1');
  expect(Object.keys(rows)).toContain('OA2');
});

test('audit on real instruction file reports all 10 risks classified', () => {
  const md = AUDIT.readMapping();
  const result = AUDIT.audit(md);
  for (const r of AUDIT.REQUIRED_RISKS) {
    expect.soft(result.classifications[r]).toBeDefined();
  }
});

test('audit on real instruction file: 0 advisory + 0 partial (post-#1987)', () => {
  const md = AUDIT.readMapping();
  const result = AUDIT.audit(md);
  const stillUnpromoted = Object.entries(result.classifications)
    .filter(([_, cls]) => cls === 'advisory' || cls === 'partial');
  expect(stillUnpromoted).toEqual([]);
});

test('audit FAILS when any row stays advisory', () => {
  const md = [
    '| # | Risk | Goals | Coverage | Mitigation |',
    '| --- | --- | --- | --- | --- |',
    '| OA1 | Goal Hijacking | G1 | Advisory | mitigation |',
    '| OA2 | Tool Misuse | G1 | **Enforced** | mitigation |',
    '| OA3 | Identity Abuse | G1 | **Enforced** | mitigation |',
    '| OA4 | Memory Poisoning | G1 | **Enforced** | mitigation |',
    '| OA5 | Cascading Failures | G1 | **Enforced** | mitigation |',
    '| OA6 | Rogue Agents | G1 | **Enforced** | mitigation |',
    '| OA7 | Supply Chain | G1 | **Enforced** | mitigation |',
    '| OA8 | Insecure Communications | G1 | **Enforced** | mitigation |',
    '| OA9 | Human-Agent Trust Exploitation | G1 | **Enforced** | mitigation |',
    '| OA10 | Code Execution | G1 | **Enforced** | mitigation |',
  ].join('\n');
  const result = AUDIT.audit(md);
  expect(result.ok).toBe(false);
});

test('audit FLAGS missing rows', () => {
  const md = [
    '| # | Risk | Goals | Coverage | Mitigation |',
    '| --- | --- | --- | --- | --- |',
    '| OA1 | Goal Hijacking | G1 | **Enforced** | x |',
  ].join('\n');
  const result = AUDIT.audit(md);
  expect(result.violations.length).toBeGreaterThan(0);
});

test('auditDeferralRationale FLAGS deferred-without-rationale', () => {
  const md = '| OA8 | Insecure Communications | G4 | **Deferred** | mit |';
  const result = AUDIT.audit(md);
  const rationaleVio = AUDIT.auditDeferralRationale(md, result.classifications);
  expect(rationaleVio.some((v) => v.rule === 'deferred-without-rationale')).toBe(true);
});

test('OA8 in real instruction file has Deferral Rationale section', () => {
  const md = AUDIT.readMapping();
  expect(md).toMatch(/##\s+OA8\s+Deferral\s+Rationale/);
});
