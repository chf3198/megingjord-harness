const test = require('node:test');
const assert = require('node:assert/strict');
const { runDetection, detectBreaches, isSuppressed, filterUnsuppressed, THRESHOLDS, DEDUP_WINDOW_MS } = require('../scripts/global/fleet-hamr-drift-detector.js');

test('THRESHOLDS exports 3 pattern definitions', () => {
  assert.equal(Object.keys(THRESHOLDS).length, 3);
});

test('DEDUP_WINDOW_MS is 7 days', () => {
  assert.equal(DEDUP_WINDOW_MS, 7 * 86400000);
});

test('detectBreaches: empty aggregate yields no breaches', () => {
  assert.deepEqual(detectBreaches({ totalCalls: 0 }), []);
});

test('detectBreaches: low fleet ratio triggers breach', () => {
  const agg = { totalCalls: 100, fleetCalls: 20, byProvider: {}, byTier: {} };
  const b = detectBreaches(agg);
  assert.ok(b.find(x => x.pattern_id === 'fleet-utilization-low'));
});

test('detectBreaches: paid-provider surge triggers breach', () => {
  const agg = { totalCalls: 100, fleetCalls: 40, byProvider: { anthropic: 50, openai: 10 }, byTier: {} };
  const b = detectBreaches(agg);
  assert.ok(b.find(x => x.pattern_id === 'paid-provider-surge'));
});

test('detectBreaches: tier-fleet misroute triggers breach', () => {
  const agg = { totalCalls: 50, fleetCalls: 30, byProvider: {}, byTier: { fleet: 10 } };
  const b = detectBreaches(agg);
  assert.ok(b.find(x => x.pattern_id === 'tier-fleet-misroute'));
});

test('detectBreaches: healthy aggregate yields no breaches', () => {
  const agg = { totalCalls: 100, fleetCalls: 70, byProvider: { ollama: 70 }, byTier: { 'fleet-local': 70 } };
  assert.deepEqual(detectBreaches(agg), []);
});

test('isSuppressed: pattern within 7-day window returns true', () => {
  const recent = Date.now() - (3 * 86400000);
  assert.equal(isSuppressed('foo', [{ pattern_id: 'foo', last_filed_ts: recent }]), true);
});

test('isSuppressed: pattern beyond 7-day window returns false', () => {
  const old = Date.now() - (10 * 86400000);
  assert.equal(isSuppressed('foo', [{ pattern_id: 'foo', last_filed_ts: old }]), false);
});

test('isSuppressed: unknown pattern returns false', () => {
  assert.equal(isSuppressed('foo', [{ pattern_id: 'bar', last_filed_ts: Date.now() }]), false);
});

test('filterUnsuppressed: drops suppressed entries', () => {
  const breaches = [{ pattern_id: 'foo' }, { pattern_id: 'bar' }];
  const supp = [{ pattern_id: 'foo', last_filed_ts: Date.now() }];
  const out = filterUnsuppressed(breaches, supp);
  assert.equal(out.length, 1);
  assert.equal(out[0].pattern_id, 'bar');
});

test('runDetection: returns {breaches, actionable, suppressed} structure', () => {
  const r = runDetection({ aggregate: { totalCalls: 100, fleetCalls: 10, byProvider: {}, byTier: {} } });
  assert.ok('breaches' in r); assert.ok('actionable' in r); assert.ok('suppressed' in r);
});
