'use strict';
// #3859 (Epic #3854 GAP-C) — measurement-base shim + census annotation.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const G = path.join(__dirname, '..', 'scripts', 'global');
const mb = require(path.join(G, 'measurement-base.js'));
const census = require(path.join(G, 'governance-surface-census.js'));

test('resolveMeasurementBase returns the documented shape and never throws', () => {
  const r = mb.resolveMeasurementBase({ cwd: path.join(__dirname, '..') });
  assert.ok('base' in r && 'behind' in r && 'fresh' in r && 'offline' in r && 'note' in r);
  assert.strictEqual(r.base, 'origin/main');
});

test('env opt-out skips the check (no git side effect)', () => {
  const prev = process.env.MEGINGJORD_NO_MEASUREMENT_BASE_CHECK;
  process.env.MEGINGJORD_NO_MEASUREMENT_BASE_CHECK = '1';
  try {
    const r = mb.resolveMeasurementBase({});
    assert.strictEqual(r.skipped, 'opt-out');
    assert.strictEqual(r.behind, null);
  } finally {
    if (prev === undefined) delete process.env.MEGINGJORD_NO_MEASUREMENT_BASE_CHECK;
    else process.env.MEGINGJORD_NO_MEASUREMENT_BASE_CHECK = prev;
  }
});

test('offline / no-remote is fail-open (behind=null, note set, never throws)', () => {
  const r = mb.resolveMeasurementBase({ base: 'nonexistent-remote-xyz/nope' });
  assert.doesNotThrow(() => JSON.stringify(r));
  assert.ok(typeof r.note === 'string' && r.note.length > 0);
  // a bogus base cannot be counted → behind is null (G6 local-tree fallback)
  assert.strictEqual(r.behind, null);
});

test('assertMeasuringOriginMain caches within a process', () => {
  mb._reset();
  const a = mb.assertMeasuringOriginMain({ quiet: true });
  const b = mb.assertMeasuringOriginMain({ quiet: true });
  assert.strictEqual(a, b); // same cached object reference
});

test('census() carries measurement_base annotation (GAP-C)', () => {
  const c = census.census({ quiet: true });
  assert.ok(c.measurement_base, 'census output must include measurement_base');
  assert.ok('behind' in c.measurement_base && 'note' in c.measurement_base);
});
