'use strict';
// tdd-pyramid spec for scripts/global/fleet-escalation-policy.js (#2930 / Epic #2926 C4).
const test = require('node:test');
const assert = require('node:assert');
const cb = require('../scripts/global/circuit-breaker');
const { classifyFailure, escalate, tierFor, CAPABILITY_NEXT } = require('../scripts/global/fleet-escalation-policy');

test('AC1: classifyFailure — availability reasons, connection errors, circuit-open', () => {
  for (const r of ['ollama_unreachable', 'fleet_unavailable', 'cascade_script_not_found', 'circuit-open',
    'ECONNREFUSED 127.0.0.1', 'fetch failed', 'socket hang up']) {
    assert.strictEqual(classifyFailure(r), 'availability', `${r} should be availability`);
  }
});

test('AC1: classifyFailure — quality reasons + null are capability', () => {
  for (const r of ['judge_low_score', 'too_short', 'no_json_found', null, undefined]) {
    assert.strictEqual(classifyFailure(r), 'capability', `${r} should be capability`);
  }
});

test('AC2: availability escalates to free-cloud, premiumBlocked, never premium', () => {
  const d = escalate({ reason: 'ollama_unreachable', currentTier: 'fleet' });
  assert.strictEqual(d.tier, 'free-cloud');
  assert.strictEqual(d.premiumBlocked, true);
  assert.strictEqual(d.failureClass, 'availability');
});

test('AC2: capability steps exactly one paid tier up (fleet→haiku, free-cloud→premium)', () => {
  assert.strictEqual(escalate({ reason: 'judge_low_score', currentTier: 'fleet' }).tier, 'haiku');
  assert.strictEqual(escalate({ reason: 'judge_low_score', currentTier: 'free-cloud' }).tier, 'premium');
  assert.strictEqual(escalate({ reason: 'too_short', currentTier: 'haiku' }).tier, 'premium');
  assert.deepStrictEqual(CAPABILITY_NEXT, { fleet: 'haiku', 'free-cloud': 'premium', haiku: 'premium', premium: 'premium' });
});

test('AC3: 5 availability failures open the breaker; escalate reports breakerOpen', () => {
  const breaker = cb.create(); // threshold 5
  let last;
  for (let i = 0; i < 5; i += 1) last = escalate({ reason: 'fleet_unavailable', breaker, nowMs: 1000 });
  assert.strictEqual(last.breakerOpen, true, 'breaker should be open after 5 availability failures');
  assert.strictEqual(last.tier, 'free-cloud', 'still free-cloud once open, never premium');
});

test('AC2/AC5 invariant: NO number of availability failures ever yields premium', () => {
  const breaker = cb.create();
  for (let i = 0; i < 50; i += 1) {
    const d = escalate({ reason: 'ollama_unreachable', breaker, nowMs: i });
    assert.notStrictEqual(d.tier, 'premium', `availability failure #${i} must never be premium`);
    assert.strictEqual(d.tier, 'free-cloud');
  }
});

test('AC4: tierFor back-compat — availability→free-cloud, capability/null→haiku', () => {
  assert.strictEqual(tierFor('ollama_unreachable'), 'free-cloud');
  assert.strictEqual(tierFor('fetch failed'), 'free-cloud');
  assert.strictEqual(tierFor('judge_low_score'), 'haiku');
  assert.strictEqual(tierFor(undefined), 'haiku');
});

// --- #2973: availability classification for fleet-outage reason strings + structural outcome ---

test('#2973 AC3: fleet-outage reason strings classify as availability', () => {
  for (const r of ['gateway-unhealthy', 'probe-failed', 'litellm-call-failed', 'litellm-threw',
    'litellm_error', 'no_litellm_url', 'empty_response', 'HTTP 400', 'HTTP 503', 'http 502']) {
    assert.strictEqual(classifyFailure(r), 'availability', `${r} should be availability`);
  }
});

test('#2973 AC3: a 3-digit HTTP status is availability; non-status text stays capability', () => {
  assert.strictEqual(classifyFailure('HTTP 429'), 'availability');
  assert.strictEqual(classifyFailure('judge_low_score'), 'capability'); // unchanged
  assert.strictEqual(classifyFailure('too_short'), 'capability');
});

test('#2973 AC1: outcome=no-answer forces availability/free-cloud regardless of reason', () => {
  // even a capability-looking reason must route to free-cloud when no answer was produced
  const d = escalate({ outcome: 'no-answer', reason: 'judge_low_score', currentTier: 'fleet' });
  assert.strictEqual(d.failureClass, 'availability');
  assert.strictEqual(d.tier, 'free-cloud');
  assert.strictEqual(d.premiumBlocked, true);
});

test('#2973 AC2: the bug shape (gateway-unhealthy + HTTP 400) escalates to free-cloud, never premium', () => {
  for (const reason of ['gateway-unhealthy', 'HTTP 400']) {
    const d = escalate({ reason, currentTier: 'fleet' });
    assert.strictEqual(d.tier, 'free-cloud', `${reason} -> free-cloud`);
    assert.strictEqual(d.premiumBlocked, true);
  }
});

test('#2973 AC6: default outcome (answered) preserves capability->haiku step-up', () => {
  assert.strictEqual(escalate({ reason: 'judge_low_score', currentTier: 'fleet' }).tier, 'haiku');
  assert.strictEqual(escalate({ outcome: 'answered', reason: 'too_short', currentTier: 'fleet' }).tier, 'haiku');
});
