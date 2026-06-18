// tests/test-floor-parity.spec.js — #3105 (Epic #1948 P1.5).
// Cross-runtime parity: the test-floor classifier is a pure function, so identical input
// must yield byte-identical output regardless of which orchestrator runtime / locale /
// timezone runs it. Regression guard against any runtime/Date/random dependence.
'use strict';

const { test, expect } = require('@playwright/test');
const tfc = require('../scripts/global/test-floor-classifier');
const evalMod = require('../scripts/global/test-floor-replay-eval');

const RUNTIME_ENVS = [
  { name: 'claude-code', env: { HAMR_TEAM: 'claude-code', TZ: 'UTC', LANG: 'en_US.UTF-8' } },
  { name: 'copilot', env: { HAMR_TEAM: 'copilot', TZ: 'America/New_York', LANG: 'C' } },
  { name: 'codex', env: { HAMR_TEAM: 'codex', TZ: 'Asia/Tokyo', LANG: 'ja_JP.UTF-8' } },
  { name: 'antigravity', env: { HAMR_TEAM: 'antigravity', TZ: 'Pacific/Kiritimati', LANG: 'de_DE.UTF-8' } },
  { name: 'cursor', env: { HAMR_TEAM: 'cursor', TZ: 'Australia/Eucla', LANG: 'fr_FR.UTF-8' } },
];

const FIXTURE = ['scripts/global/merge-claim-gate.js', 'instructions/x.md', 'hooks/scripts/y.py'];

function underEnv(envOverrides, render) {
  const saved = {};
  for (const key of Object.keys(envOverrides)) { saved[key] = process.env[key]; process.env[key] = envOverrides[key]; }
  try { return render(); } finally {
    for (const key of Object.keys(envOverrides)) {
      if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
    }
  }
}

test('reconcile() is byte-identical across all orchestrator runtimes', () => {
  const outputs = RUNTIME_ENVS.map((runtime) => ({
    name: runtime.name,
    text: underEnv(runtime.env, () => JSON.stringify(tfc.reconcile('tdd-pyramid', FIXTURE))),
  }));
  const reference = outputs[0].text;
  expect(reference.length).toBeGreaterThan(0);
  for (const output of outputs) expect(output.text, `reconcile drifted under ${output.name}`).toBe(reference);
});

test('replayEval() is byte-identical across all orchestrator runtimes', () => {
  const corpus = evalMod.loadCorpus();
  const outputs = RUNTIME_ENVS.map((runtime) => ({
    name: runtime.name,
    text: underEnv(runtime.env, () => JSON.stringify(evalMod.replayEval(corpus))),
  }));
  const reference = outputs[0].text;
  for (const output of outputs) expect(output.text, `replayEval drifted under ${output.name}`).toBe(reference);
});

test('auditRecord() with a fixed ts is byte-identical across runtimes', () => {
  const result = tfc.reconcile('none', FIXTURE);
  const outputs = RUNTIME_ENVS.map((runtime) =>
    underEnv(runtime.env, () => JSON.stringify(tfc.auditRecord(result, { ts: '2026-06-18T00:00:00Z', ticket: 3105 }))));
  for (const output of outputs) expect(output).toBe(outputs[0]);
});
