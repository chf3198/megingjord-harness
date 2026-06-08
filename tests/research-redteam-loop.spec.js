// Refs #2720 — eval-harness tests for research-redteam-loop skill
// Tests: AC8 (a)-(e) coverage: failover, all-fail, web-fail, fast-accept, cap.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// ---- minimal stubs ----

function makeFleetDispatch(responses) {
  let idx = 0;
  return async () => responses[idx++] ?? { ok: false, reason: 'exhausted' };
}

function makeFreeCloudDispatch(responses) {
  let idx = 0;
  return async () => responses[idx++] ?? { ok: false, reason: 'exhausted' };
}

// Core loop under test (inline — no file import required; behaviour spec only)
async function runLoop(opts = {}) {
  const {
    gate = 93, cap = 5,
    fleetFn, freeCloudFn, webSearchFn,
    reworkFn = async (d) => d,
  } = opts;

  const iterations = [];
  let deliverable = opts.deliverable || 'initial';

  for (let i = 1; i <= cap; i++) {
    // web augmentation (degrades on failure — AC: c)
    let webContext = null;
    try { webContext = webSearchFn ? await webSearchFn() : null; } catch { /* degraded */ }

    // dispatch fleet → free-cloud (AC: a)
    let result = await fleetFn();
    if (!result.ok) result = await freeCloudFn();

    // all-fail path (AC: b)
    if (!result.ok) {
      return { verdict: 'REJECT', reason: 'all_reviewers_failed', iterations };
    }

    const score = result.score;
    iterations.push({ iter: i, score, web: !!webContext, reviewer: result.model });

    if (score > gate) {
      return { verdict: 'ACCEPT', score, iterations, reviewer: result.model };
    }
    deliverable = await reworkFn(deliverable, result);
  }

  // cap exhausted (AC: e)
  return { verdict: 'REJECT', reason: 'max_iterations_reached', iterations };
}

// ---- AC8 tests ----

test('AC8-a: fleet unreachable → free-cloud fallback invoked', async () => {
  const fleet = makeFleetDispatch([{ ok: false, reason: 'timeout' }]);
  const free = makeFleetDispatch([{ ok: true, score: 95, model: 'gemini@free' }]);
  const res = await runLoop({ fleetFn: fleet, freeCloudFn: free, gate: 93 });
  assert.equal(res.verdict, 'ACCEPT');
  assert.equal(res.reviewer, 'gemini@free');
});

test('AC8-b: all reviewers fail → REJECT emitted, no throw', async () => {
  const fleet = makeFleetDispatch([{ ok: false, reason: 'timeout' }]);
  const free = makeFleetDispatch([{ ok: false, reason: 'no_key' }]);
  const res = await runLoop({ fleetFn: fleet, freeCloudFn: free });
  assert.equal(res.verdict, 'REJECT');
  assert.equal(res.reason, 'all_reviewers_failed');
});

test('AC8-c: web search fails → no throw, web=false in iteration', async () => {
  const fleet = makeFleetDispatch([{ ok: true, score: 95, model: 'qwen@fleet' }]);
  const free = makeFleetDispatch([]);
  const badWeb = async () => { throw new Error('search_unavailable'); };
  const res = await runLoop({ fleetFn: fleet, freeCloudFn: free, webSearchFn: badWeb });
  assert.equal(res.verdict, 'ACCEPT');
  assert.equal(res.iterations[0].web, false);
});

test('AC8-d: score > gate on iteration 1 → ACCEPT immediately', async () => {
  const fleet = makeFleetDispatch([{ ok: true, score: 96, model: 'qwen@fleet' }]);
  const free = makeFleetDispatch([]);
  const res = await runLoop({ fleetFn: fleet, freeCloudFn: free, gate: 93 });
  assert.equal(res.verdict, 'ACCEPT');
  assert.equal(res.iterations.length, 1);
});

test('AC8-e: score ≤ gate × cap iterations → REJECT after cap', async () => {
  const below = { ok: true, score: 80, model: 'qwen@fleet' };
  const fleet = makeFleetDispatch(Array(5).fill(below));
  const free = makeFleetDispatch([]);
  const res = await runLoop({ fleetFn: fleet, freeCloudFn: free, gate: 93, cap: 5 });
  assert.equal(res.verdict, 'REJECT');
  assert.equal(res.reason, 'max_iterations_reached');
  assert.equal(res.iterations.length, 5);
});
