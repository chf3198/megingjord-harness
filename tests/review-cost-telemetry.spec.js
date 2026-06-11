'use strict';
// tdd-pyramid spec for scripts/global/review-cost-telemetry.js (#2932 / Epic #2926 C6).
const test = require('node:test');
const assert = require('node:assert');
const T = require('../scripts/global/review-cost-telemetry');

function reviewRow(tier, latency_ms, stakes = 'standard') {
  return { review: true, lane: tier, latency_ms, stakes };
}

test('AC1: recordReviewDispatch tags review+paid+stakes via the injectable append', () => {
  const captured = [];
  const r = T.recordReviewDispatch({ tier: 'premium', stakes: 'high', model: 'gemini-pro', latencyMs: 1200 },
    { append: (e) => captured.push(e) });
  assert.strictEqual(r.recorded, true);
  assert.strictEqual(captured.length, 1);
  assert.deepStrictEqual(
    { review: captured[0].review, paid: captured[0].paid, stakes: captured[0].stakes, lane: captured[0].lane },
    { review: true, paid: true, stakes: 'high', lane: 'premium' });
});

test('AC1: MEGINGJORD_NO_TELEMETRY=1 makes recordReviewDispatch a no-op (isolation)', () => {
  const prev = process.env.MEGINGJORD_NO_TELEMETRY;
  process.env.MEGINGJORD_NO_TELEMETRY = '1';
  try {
    const captured = [];
    const r = T.recordReviewDispatch({ tier: 'fleet' }, { append: (e) => captured.push(e) });
    assert.strictEqual(r.recorded, false);
    assert.strictEqual(captured.length, 0, 'no append under telemetry isolation');
  } finally {
    if (prev === undefined) delete process.env.MEGINGJORD_NO_TELEMETRY; else process.env.MEGINGJORD_NO_TELEMETRY = prev;
  }
});

test('AC1: fleet + free-cloud are NOT paid; haiku + premium ARE paid', () => {
  assert.strictEqual(T.isPaid('fleet'), false);
  assert.strictEqual(T.isPaid('free-cloud'), false);
  assert.strictEqual(T.isPaid('haiku'), true);
  assert.strictEqual(T.isPaid('premium'), true);
});

test('AC2: reviewCostReport computes free-vs-paid ratio + per-tier p50/p99', () => {
  const rows = [
    reviewRow('fleet', 10), reviewRow('fleet', 20), reviewRow('free-cloud', 30),
    reviewRow('haiku', 100), reviewRow('premium', 200),
    { review: false, lane: 'fleet', latency_ms: 5 }, // non-review row ignored
  ];
  const rep = T.reviewCostReport(rows);
  assert.strictEqual(rep.total, 5);
  assert.strictEqual(rep.free, 3); // fleet x2 + free-cloud
  assert.strictEqual(rep.paid, 2); // haiku + premium
  assert.strictEqual(rep.freeVsPaidRatio, 1.5);
  assert.strictEqual(rep.premiumShare, 0.2);
  assert.strictEqual(rep.perTier.fleet.count, 2);
  assert.strictEqual(rep.perTier.fleet.p50, 10);
  assert.strictEqual(rep.perTier.premium.p99, 200);
});

test('AC2: empty/all-free edge cases', () => {
  assert.strictEqual(T.reviewCostReport([]).freeVsPaidRatio, 0);
  assert.strictEqual(T.reviewCostReport([reviewRow('fleet', 1)]).freeVsPaidRatio, Infinity);
});

test('AC3: premiumShareGovernor breaches above threshold only', () => {
  // 3 premium / 10 = 30% > 20% → breach.
  const breachRows = Array.from({ length: 10 }, (_, i) => reviewRow(i < 3 ? 'premium' : 'fleet', 5));
  const b = T.premiumShareGovernor(breachRows);
  assert.strictEqual(b.breach, true);
  assert.ok(Math.abs(b.premiumShare - 0.3) < 1e-9);
  // 1 premium / 10 = 10% < 20% → no breach.
  const okRows = Array.from({ length: 10 }, (_, i) => reviewRow(i < 1 ? 'premium' : 'fleet', 5));
  assert.strictEqual(T.premiumShareGovernor(okRows).breach, false);
  // empty → no breach.
  assert.strictEqual(T.premiumShareGovernor([]).breach, false);
});

test('AC3: emitGovernorAnneal emits ONLY on breach, via injectable sink', () => {
  const sink = [];
  assert.strictEqual(T.emitGovernorAnneal({ breach: false }, { sink: (e) => sink.push(e) }).emitted, false);
  assert.strictEqual(sink.length, 0);
  const out = T.emitGovernorAnneal({ breach: true, premiumShare: 0.3, thresholdPct: 20 }, { sink: (e) => sink.push(e), ts: '2026-06-11T00:00:00Z' });
  assert.strictEqual(out.emitted, true);
  assert.strictEqual(sink.length, 1);
  assert.strictEqual(sink[0].pattern_id, 'review-premium-share-exceeds-threshold');
  assert.strictEqual(sink[0].premium_share, 0.3);
});

test('AC2 hardening (#2932 review): percentile is clamped — no out-of-bounds at p99 for any length', () => {
  // 1-element, 5-element, 100-element — p99 index must never exceed the array.
  assert.strictEqual(T.reviewCostReport([reviewRow('fleet', 42)]).perTier.fleet.p99, 42);
  const hundred = Array.from({ length: 100 }, (_, i) => reviewRow('fleet', i + 1));
  const rep = T.reviewCostReport(hundred);
  assert.strictEqual(rep.perTier.fleet.count, 100);
  assert.ok(rep.perTier.fleet.p99 <= 100 && rep.perTier.fleet.p99 >= 99, `p99 in-range, got ${rep.perTier.fleet.p99}`);
});

test('AC3 hardening: governor does NOT breach at EXACTLY 20% (strict > per ">20%" spec)', () => {
  const exactly20 = Array.from({ length: 10 }, (_, i) => reviewRow(i < 2 ? 'premium' : 'fleet', 5)); // 2/10 = 20%
  const g = T.premiumShareGovernor(exactly20);
  assert.strictEqual(g.premiumShare, 0.2);
  assert.strictEqual(g.breach, false, 'exactly 20% must not breach ">20%"');
});

test('AC2 hardening: reviewCostReport does NOT mutate input rows; repeated calls are identical', () => {
  const rows = [reviewRow('fleet', 30), reviewRow('fleet', 10), reviewRow('premium', 200)];
  const snapshot = JSON.stringify(rows);
  const a = T.reviewCostReport(rows);
  const b = T.reviewCostReport(rows);
  assert.strictEqual(JSON.stringify(rows), snapshot, 'input rows must be untouched (no aliasing)');
  assert.deepStrictEqual(a, b, 'pure/idempotent across calls');
});

test('AC4: routeAndRecord ties the stakes-router to telemetry (tier+stakes captured)', () => {
  const captured = [];
  const route = T.routeAndRecord(
    { paths: ['hooks/scripts/pretool_guard.py'], authorFamily: 'anthropic', latencyMs: 900 },
    { append: (e) => captured.push(e) });
  assert.strictEqual(route.stakes, 'high');
  assert.strictEqual(route.tier, 'premium');
  assert.strictEqual(captured.length, 1);
  assert.strictEqual(captured[0].stakes, 'high');
  assert.strictEqual(captured[0].lane, 'premium');
});
