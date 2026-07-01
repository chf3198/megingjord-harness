'use strict';
// tdd-pyramid unit tests for the Fleet Advisor Layer-② AI-research pass (Epic #3414 #3481).
// Goal alignment: G2 quality, G6 resilience (non-blocking degrade), G4 (advisory-only, never auto-acts).

const assert = require('node:assert/strict');
const { test } = require('node:test');
const ai = require('../scripts/global/fleet-advisor-ai-pass.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;
const lintReport = {
  tier: 'F2',
  fingerprint: { hash: 'abc', hosts: [{ engine: 'ollama@0.30', vramBucket: 'discrete' }] },
  findings: [{ id: 'L-OFFLOAD-01', severity: 'high', class: 'IT-actionable', title: '32B offloaded', source: 'lint' }],
};

test('composeResearchPrompt names tier, hardware, and lint findings; asks for $0 + sources', () => {
  const prompt = ai.composeResearchPrompt(lintReport);
  assert.match(prompt, /F2/);
  assert.match(prompt, /L-OFFLOAD-01/);
  assert.match(prompt, /\$0/);
  assert.match(prompt, /source/i);
});

test('AC1 — degrades to lint-only when the panel is fully unreachable, never throws', async () => {
  const dispatch = async () => { throw new Error('panel down'); };
  const out = await ai.runAiPass(lintReport, { dispatch, now: NOW, maxAttempts: 3, backoffMs: 0 });
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].id, 'L-OFFLOAD-01');
  assert.match(out.aiPass.status, /unavailable|no-dispatch/);
});

test('AC1 — no dispatch provided yields lint-only, non-blocking', async () => {
  const out = await ai.runAiPass(lintReport, { now: NOW });
  assert.equal(out.findings.length, 1);
  assert.equal(out.aiPass.aiFindingCount, 0);
});

test('AC2 — stale AI finding (past tier window) is demoted to informational + STALE-tagged', () => {
  const f = ai.applyTrustControls(
    { id: 'AI-1', title: 'use flash attention', recommendation: 'enable', severity: 'high',
      freshness_tier: 'standard', as_of: new Date(NOW - 8 * DAY).toISOString(), citation: 'http://x', expectedGain: '20%' },
    NOW);
  assert.equal(f.severity, 'informational');
  assert.match(f.title, /^STALE:/);
});

test('AC2 — past 2x the freshness tier the finding is DROPPED entirely', () => {
  const f = ai.applyTrustControls(
    { id: 'AI-1', title: 'old', severity: 'med', freshness_tier: 'volatile', as_of: new Date(NOW - 7 * DAY).toISOString() },
    NOW);
  assert.equal(f, null); // volatile tier = 3d; 2x = 6d; 7d old → dropped
});

test('AC2 — citation-or-low-trust: uncited frontier claim capped at informational + trust low', () => {
  const f = ai.applyTrustControls(
    { id: 'AI-2', title: 'speculative decoding gives 2x', severity: 'high', as_of: new Date(NOW).toISOString(), expectedGain: '2x' },
    NOW);
  assert.equal(f.severity, 'informational');
  assert.equal(f.trust, 'low');
});

test('AC2 — quantified-gain: frontier claim without a magnitude capped at informational', () => {
  const f = ai.applyTrustControls(
    { id: 'AI-3', title: 'continuous batching is faster', severity: 'high', as_of: new Date(NOW).toISOString(), citation: 'http://vllm' },
    NOW);
  assert.equal(f.severity, 'informational');
});

test('AC2 — a fresh, cited, quantified non-frontier rec keeps its severity', () => {
  const f = ai.applyTrustControls(
    { id: 'AI-4', title: 'set keep_alive', recommendation: 'keep hot model resident', severity: 'med',
      as_of: new Date(NOW).toISOString(), citation: 'http://ollama', expectedGain: 'removes cold-load' },
    NOW);
  assert.equal(f.severity, 'med');
  assert.equal(f.trust, 'high');
});

test('AC3 — retry/backoff: succeeds on the 3rd attempt after two failures', async () => {
  let attempts = 0;
  const dispatch = async () => { attempts++; if (attempts < 3) throw new Error('rate limit'); return { findings: [] }; };
  const sleeps = [];
  const out = await ai.runAiPass(lintReport, { dispatch, now: NOW, maxAttempts: 3, backoffMs: 10, sleep: async (ms) => sleeps.push(ms) });
  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [10, 20]); // backoff grows per attempt
  assert.equal(out.aiPass.status, 'ok');
});

test('merge — lint finding is authoritative; overlapping AI folds in as support', async () => {
  const dispatch = async () => ({ findings: [{ id: 'L-OFFLOAD-01', title: 'route to 7B', recommendation: 'route hot path to 7B', as_of: new Date(NOW).toISOString() }] });
  const out = await ai.runAiPass(lintReport, { dispatch, now: NOW });
  const lint = out.findings.find((f) => f.id === 'L-OFFLOAD-01');
  assert.equal(lint.source, 'lint');
  assert.ok(lint.aiSupport, 'AI folded as support');
  assert.equal(out.findings.filter((f) => f.id === 'L-OFFLOAD-01').length, 1);
});

test('merge — AI-only finding is NEVER auto-promoted to high (capped at med)', async () => {
  const dispatch = async () => ({ findings: [{ id: 'AI-NEW', title: 'try dynamo router', recommendation: 'x', severity: 'high', as_of: new Date(NOW).toISOString() }] });
  const out = await ai.runAiPass(lintReport, { dispatch, now: NOW });
  const aiOnly = out.findings.find((f) => f.id === 'AI-NEW');
  assert.ok(aiOnly.aiOnly);
  assert.notEqual(aiOnly.severity, 'high');
});

test('cached fallback tagged stale-cache when live pass fails but cache exists', async () => {
  const dispatch = async () => { throw new Error('down'); };
  const cached = [{ id: 'AI-C', title: 'cached tip', severity: 'med', as_of: new Date(NOW - DAY).toISOString(), citation: 'http://x', expectedGain: 'n/a' }];
  const out = await ai.runAiPass(lintReport, { dispatch, now: NOW, maxAttempts: 1, cachedFindings: cached });
  assert.equal(out.aiPass.usedCache, true);
  assert.equal(out.aiPass.status, 'stale-cache');
});
