'use strict';
// tdd-pyramid unit tests for the Fleet Advisor background trigger (Epic #3414 #3483).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const trig = require('../scripts/global/fleet-advisor-trigger.js');

const lintReport = { tier: 'F2', fingerprint: { hash: 'HASH1' }, findings: [] };
const runLint = () => lintReport;

test('AC1 — unchanged + fresh fingerprint runs NO AI pass (zero tokens)', async () => {
  let aiCalls = 0;
  const out = await trig.runTrigger({
    runLint, runAiPass: async () => { aiCalls++; return {}; },
    cache: { hash: 'HASH1', ts: 1000 }, now: 1500, staleMs: 100000,
  });
  assert.equal(out.status, 'skipped-unchanged');
  assert.equal(out.aiRan, false);
  assert.equal(out.aiTokensSpent, 0);
  assert.equal(aiCalls, 0);
});

test('AC1 — a changed fingerprint runs the AI pass', async () => {
  let aiCalls = 0;
  const out = await trig.runTrigger({
    runLint, runAiPass: async () => { aiCalls++; return { aiPass: { aiFindingCount: 1 } }; },
    cache: { hash: 'OLD', ts: 1000 }, now: 1500,
  });
  assert.equal(out.status, 'ran');
  assert.equal(out.aiRan, true);
  assert.equal(aiCalls, 1);
});

test('AC1 — a cold cache (no prior run) runs the AI pass', async () => {
  const out = await trig.runTrigger({ runLint, runAiPass: async () => ({}), cache: null, now: 1 });
  assert.equal(out.reason, 'cold-cache');
  assert.equal(out.status, 'ran');
});

test('AC1 — stale cache re-runs even when unchanged', () => {
  const d = trig.shouldRunAiPass('H', { hash: 'H', ts: 1000 }, { now: 1000 + 2 * trig.DEFAULT_STALE_MS });
  assert.equal(d.run, true);
  assert.equal(d.reason, 'stale-cache');
});

test('AC2 — FLEET_ADVISOR_DISABLED=1 is a clean no-op (no lint, no AI)', async () => {
  let touched = 0;
  const out = await trig.runTrigger({
    env: { FLEET_ADVISOR_DISABLED: '1' },
    runLint: () => { touched++; return lintReport; }, runAiPass: async () => { touched++; return {}; },
  });
  assert.equal(out.status, 'disabled');
  assert.equal(out.aiTokensSpent, 0);
  assert.equal(touched, 0);
});

test('AC2 — kill-switch: AI timeout does not block; trigger returns with aiRan false', async () => {
  const slowAi = () => new Promise((r) => { const t = setTimeout(() => r({}), 60000); if (t.unref) t.unref(); });
  const out = await trig.runTrigger({
    runLint, runAiPass: slowAi, cache: { hash: 'OLD', ts: 0 }, now: 1,
    killSwitches: { aiTimeoutMs: 20 },
  });
  assert.equal(out.status, 'ran');
  assert.equal(out.aiRan, false);
  assert.equal(out.report.tier, 'F2'); // falls back to the lint report
});

test('AC2 — a single AI dispatch only (no agentic loop)', async () => {
  let calls = 0;
  await trig.runTrigger({ runLint, runAiPass: async () => { calls++; return {}; }, cache: null, now: 1 });
  assert.equal(calls, 1);
});

test('never throws / never blocks on a lint error or missing injections', async () => {
  const bad = await trig.runTrigger({ runLint: () => { throw new Error('probe down'); }, cache: null });
  assert.equal(bad.status, 'lint-error');
  const noLint = await trig.runTrigger({});
  assert.equal(noLint.status, 'no-lint');
});

test('AC2 — AI error is caught; trigger still returns cleanly', async () => {
  const out = await trig.runTrigger({
    runLint, runAiPass: async () => { throw new Error('panel down'); },
    cache: { hash: 'OLD', ts: 0 }, now: 1,
  });
  assert.equal(out.status, 'ran');
  assert.equal(out.aiRan, false);
  assert.match(out.report.tier, /F2/);
});
