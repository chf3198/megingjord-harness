// baton-override-telemetry.spec.js -- Tests for override-telemetry.
// Refs #3292, Epic #3284 (W4). AC4: per-gate telemetry + Tier-2 threshold.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  aggregateOverrides,
  buildTier2Incident,
} = require('../scripts/global/baton-bypass/override-telemetry');

// -- aggregateOverrides --

describe('aggregateOverrides', () => {
  const NOW = '2026-06-28T12:00:00Z';

  it('counts events per gate within the window', () => {
    const events = [
      { ts: '2026-06-27T00:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T01:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T02:00:00Z', gate: 'pre-push' },
    ];
    const result = aggregateOverrides(events, {
      windowDays: 7, perGateThreshold: 10, nowIso: NOW,
    });
    assert.equal(result.counts['lint'], 2);
    assert.equal(result.counts['pre-push'], 1);
    assert.equal(result.incidents.length, 0);
  });

  it('excludes events outside the window', () => {
    const events = [
      { ts: '2026-01-01T00:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T00:00:00Z', gate: 'lint' },
    ];
    const result = aggregateOverrides(events, {
      windowDays: 7, perGateThreshold: 10, nowIso: NOW,
    });
    assert.equal(result.counts['lint'], 1);
  });

  it('emits Tier-2 incident when threshold is exceeded', () => {
    const events = [
      { ts: '2026-06-27T00:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T01:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T02:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T03:00:00Z', gate: 'lint' },
    ];
    const result = aggregateOverrides(events, {
      windowDays: 7, perGateThreshold: 3, nowIso: NOW,
    });
    assert.equal(result.counts['lint'], 4);
    assert.equal(result.incidents.length, 1);
    assert.equal(result.incidents[0].tier, 2);
    assert.equal(result.incidents[0].event, 'override-threshold-breach');
    assert.equal(result.incidents[0].evidence.gate, 'lint');
    assert.equal(result.incidents[0].evidence.count, 4);
  });

  it('does not emit incident when count equals the threshold (only on exceed)', () => {
    const events = [
      { ts: '2026-06-27T00:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T01:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T02:00:00Z', gate: 'lint' },
    ];
    const result = aggregateOverrides(events, {
      windowDays: 7, perGateThreshold: 3, nowIso: NOW,
    });
    assert.equal(result.incidents.length, 0);
  });

  it('handles empty events list', () => {
    const result = aggregateOverrides([], {
      windowDays: 7, perGateThreshold: 3, nowIso: NOW,
    });
    assert.deepEqual(result.counts, {});
    assert.equal(result.incidents.length, 0);
  });

  it('handles multiple gates independently', () => {
    const events = [
      { ts: '2026-06-27T00:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T01:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T02:00:00Z', gate: 'pre-push' },
      { ts: '2026-06-27T03:00:00Z', gate: 'lint' },
      { ts: '2026-06-27T04:00:00Z', gate: 'lint' },
    ];
    const result = aggregateOverrides(events, {
      windowDays: 7, perGateThreshold: 3, nowIso: NOW,
    });
    assert.equal(result.counts['lint'], 4);
    assert.equal(result.counts['pre-push'], 1);
    // Only lint exceeds threshold
    assert.equal(result.incidents.length, 1);
    assert.equal(result.incidents[0].evidence.gate, 'lint');
  });
});

// -- buildTier2Incident --

describe('buildTier2Incident', () => {
  it('produces a valid v3 schema event', () => {
    const incident = buildTier2Incident('lint', 5, 3, {
      nowIso: '2026-06-28T12:00:00Z',
    });
    assert.equal(incident.version, 3);
    assert.equal(incident.tier, 2);
    assert.equal(incident.service, 'baton-bypass');
    assert.equal(incident.event, 'override-threshold-breach');
    assert.equal(incident.pattern_id, 'override-gate-overuse');
    assert.equal(incident.severity, 'medium');
    assert.equal(incident.evidence.gate, 'lint');
    assert.equal(incident.evidence.count, 5);
    assert.equal(incident.evidence.threshold, 3);
    assert.ok(incident._summary.includes('lint'));
  });
});
