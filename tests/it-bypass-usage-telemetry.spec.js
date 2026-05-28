// it-bypass-usage-telemetry.spec.js — tdd-pyramid tests for AC2+AC4+AC7. Refs #2351.
// test_strategy: tdd-pyramid
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const { spawnSync } = require('child_process');

const REPORT = path.join(__dirname, '../scripts/global/it-bypass-usage-report');

// ── Python emitter: build_event produces required fields ───────────────────
test('it_bypass_emit build_event contains required JSONL fields', () => {
  const pyScript = `
import sys, json
sys.path.insert(0, 'hooks/scripts')
from it_bypass_emit import build_event
event = build_event('commit-subject-marker', '.')
required = ['version', 'ts', 'service', 'env', 'event', 'marker']
for field in required:
    assert field in event, f'missing field: {field}'
assert event['marker'] == 'commit-subject-marker'
assert event['version'] == 3
assert event['event'] == 'it_ops.bypass_used'
print('ok')
`;
  const result = spawnSync('python3', ['-c', pyScript],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('ok');
});

// ── Python emitter: env marker detected ───────────────────────────────────
test('it_bypass_emit build_event accepts env:MEGINGJORD_IT_OPS=1 marker', () => {
  const pyScript = `
import sys, json
sys.path.insert(0, 'hooks/scripts')
from it_bypass_emit import build_event
event = build_event('env:MEGINGJORD_IT_OPS=1', '.')
assert event['marker'] == 'env:MEGINGJORD_IT_OPS=1'
print('ok')
`;
  const result = spawnSync('python3', ['-c', pyScript],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('ok');
});

// ── Python emitter: emit_bypass returns bool and does not raise ────────────
test('emit_bypass is best-effort and returns a bool without raising', () => {
  const pyScript = `
import sys
sys.path.insert(0, 'hooks/scripts')
from it_bypass_emit import emit_bypass
result = emit_bypass('commit-subject-marker', '.')
assert isinstance(result, bool), f'expected bool, got {type(result)}'
print('ok')
`;
  const result = spawnSync('python3', ['-c', pyScript],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('ok');
});

// ── isoWeekKey: cross-week boundary returns distinct keys ─────────────────
test('isoWeekKey returns distinct keys for dates in different weeks', () => {
  const { isoWeekKey } = require(REPORT);
  const week1 = isoWeekKey('2026-05-18T12:00:00Z');
  const week2 = isoWeekKey('2026-05-25T12:00:00Z');
  expect(week1).not.toBe(week2);
});

// ── aggregateByMarkerWeek: counts per marker×week ─────────────────────────
test('aggregateByMarkerWeek counts events per marker and week', () => {
  const { aggregateByMarkerWeek, isoWeekKey } = require(REPORT);
  const week = isoWeekKey(new Date().toISOString());
  const events = [
    { marker: 'commit-subject-marker', ts: new Date().toISOString() },
    { marker: 'commit-subject-marker', ts: new Date().toISOString() },
    { marker: 'env:MEGINGJORD_IT_OPS=1', ts: new Date().toISOString() },
  ];
  const counts = aggregateByMarkerWeek(events);
  expect(counts[`commit-subject-marker::${week}`]).toBe(2);
  expect(counts[`env:MEGINGJORD_IT_OPS=1::${week}`]).toBe(1);
});

// ── aggregateByMarkerWeek: missing marker defaults to 'unknown' ────────────
test('aggregateByMarkerWeek uses unknown for missing marker field', () => {
  const { aggregateByMarkerWeek, isoWeekKey } = require(REPORT);
  const week = isoWeekKey(new Date().toISOString());
  const events = [{ ts: new Date().toISOString() }];
  const counts = aggregateByMarkerWeek(events);
  expect(counts[`unknown::${week}`]).toBe(1);
});

// ── buildTier2Event: valid Tier-2 anneal structure ─────────────────────────
test('buildTier2Event produces valid Tier-2 anneal event for IT-bypass', () => {
  const { buildTier2Event } = require(REPORT);
  const event = buildTier2Event('commit-subject-marker', '2026-W22', 8, 5);
  expect(event.version).toBe(3);
  expect(event.event).toBe('anneal.tier2');
  expect(event.tier).toBe('tier-2');
  expect(event.severity).toBe('medium');
  expect(event.pattern_id).toContain('it-bypass-usage-exceeded');
  expect(event.pattern_id).toContain('commit-subject-marker');
  expect(event.evidence).toContain('count=8');
  expect(event.evidence).toContain('threshold=5');
  expect(typeof event._summary).toBe('string');
  expect(event._summary.length).toBeLessThanOrEqual(200);
});

// ── threshold breach: anneal fires when count exceeds threshold ────────────
test('buildTier2Event threshold breach is reflected in evidence', () => {
  const { buildTier2Event } = require(REPORT);
  const event = buildTier2Event('env:MEGINGJORD_IT_OPS=1', '2026-W23', 12, 5);
  expect(event.evidence).toContain('count=12');
  expect(event.evidence).toContain('threshold=5');
  expect(event.pattern_id).toContain('env:MEGINGJORD_IT_OPS=1');
});

// ── run: does not throw when log missing ───────────────────────────────────
test('run returns empty result when bypass log is missing', () => {
  const { run } = require(REPORT);
  const fs = require('fs');
  const { BYPASS_LOG } = require(REPORT);
  if (!fs.existsSync(BYPASS_LOG)) {
    const result = run();
    expect(result).toBeDefined();
    expect(Array.isArray(result.annealsFired)).toBe(true);
    expect(Object.keys(result.counts).length).toBe(0);
  } else {
    expect(() => run()).not.toThrow();
  }
});
