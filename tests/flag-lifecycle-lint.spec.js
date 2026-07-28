// flag-lifecycle-lint.spec.js -- Tests for the dark-launch flag lifecycle lint + G8 inventory.
// Refs #3795, Epic #3789. AC3 (dark-not-flipped-inventory) + AC4 (flag-lifecycle-lint). tdd-pyramid.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const lint = require('../scripts/global/megalint/flag-lifecycle-lint');
const { inventory } = require('../scripts/global/dark-not-flipped-inventory');

// A flag name that is genuinely referenced in the tree (it ships in env-flag-classifier.js).
const REFERENCED_FLAG = 'MEGINGJORD_MCP_ADAPTER_ENABLED';
const ABSENT_FLAG = 'MEGINGJORD_NONEXISTENT_FLAG_XYZ';

describe('flag-lifecycle-lint (AC4)', () => {
  it('passes a dark flag with no retire_by set', () => {
    const registry = { flags: { [REFERENCED_FLAG]: { state: 'dark', retire_by: null } } };
    assert.deepEqual(lint.validate({ registry, now: '2026-07-13' }), { ok: true, violations: [] });
  });

  it('FAILS a flag past retire_by that is still referenced in the tree', () => {
    const registry = { flags: { [REFERENCED_FLAG]: { state: 'flipped', retire_by: '2026-01-01' } } };
    const r = lint.validate({ registry, now: '2026-07-13' });
    assert.equal(r.ok, false);
    assert.equal(r.violations[0].rule, 'flag-past-retire-by-still-referenced');
  });

  it('passes a flag past retire_by that is no longer referenced (dead path removed)', () => {
    const registry = { flags: { [ABSENT_FLAG]: { state: 'flipped', retire_by: '2026-01-01' } } };
    assert.equal(lint.validate({ registry, now: '2026-07-13' }).ok, true);
  });

  it('skips retired flags entirely', () => {
    const registry = { flags: { [REFERENCED_FLAG]: { state: 'retired', retire_by: '2026-01-01' } } };
    assert.equal(lint.validate({ registry, now: '2026-07-13' }).ok, true);
  });

  it('fails closed on an unreadable registry', () => {
    const r = lint.validate({ registry: { _error: 'boom', flags: {} } });
    assert.equal(r.ok, false);
    assert.equal(r.violations[0].rule, 'flag-lifecycle-registry-unreadable');
  });

  it('the shipped registry passes (MCP adapter flag is dark, not past retire_by)', () => {
    assert.equal(lint.validate({ now: '2026-07-13' }).ok, true);
  });
});

describe('dark-not-flipped-inventory (AC3)', () => {
  it('counts flags in dark or canary state as pending', () => {
    const registry = { flags: {
      A: { state: 'dark', created: { ticket: 1 } },
      B: { state: 'canary', created: { ticket: 2 } },
      C: { state: 'flipped', created: { ticket: 3 } },
    } };
    const inv = inventory(registry);
    assert.equal(inv.count, 2);
    assert.deepEqual(inv.flags.map((f) => f.flag).sort(), ['A', 'B']);
  });

  it('the shipped registry reports the MCP adapter flag as dark-not-flipped', () => {
    const inv = inventory();
    assert.ok(inv.count >= 1);
    assert.ok(inv.flags.some((f) => f.flag === REFERENCED_FLAG));
  });
});
