// tests/wiki-health-detector.spec.js — #3068, Epic #3063 (the anti-recurrence core).
// Strategy: tdd-pyramid. Metrics, AC2 thresholds, AC3 promotion, AC4 regression
// (the exact 2026-06-16 empty-store condition trips Tier-2).
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const wh = require('../scripts/wiki/wiki-health-detector');

// ── synthetic Wiki B store helpers (gray-matter frontmatter) ──

function mkStore(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-b-'));
  entries.forEach((fm, index) => {
    const yaml = Object.entries(fm).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
    fs.writeFileSync(path.join(dir, `${index}.md`), `---\n${yaml}\n---\nbody\n`);
  });
  return dir;
}
const fresh = (extra = {}) => ({ type: 'work-log', last_updated: new Date().toISOString().slice(0, 10), source_path: 'github:issue/1', ...extra });

// ── AC1 metrics: computeStoreHealth(B) ──

test('B: a populated, fresh, valid store reads coverage 1, stale 0, consistency 0', () => {
  const dir = mkStore([fresh(), fresh(), fresh()]);
  const health = wh.computeStoreHealth('B', { wlDirs: [dir] });
  expect(health.coverage_ratio).toBe(1);
  expect(health.stale_ratio).toBe(0);
  expect(health.consistency_errors).toBe(0);
  expect(health.entry_count).toBe(3);
});

test('B: entries missing required frontmatter count as consistency_errors', () => {
  const dir = mkStore([fresh(), { type: 'work-log' }, { source_path: 'x' }]);
  expect(wh.computeStoreHealth('B', { wlDirs: [dir] }).consistency_errors).toBe(2);
});

test('B: a stalled mirror (newest entry past the liveness window) reads stale_ratio 1', () => {
  const dir = mkStore([fresh({ last_updated: '2020-01-01' }), fresh({ last_updated: '2020-02-01' })]);
  expect(wh.computeStoreHealth('B', { wlDirs: [dir] }).stale_ratio).toBe(1);
});

test('B: empty store with sources present reads coverage 0', () => {
  const health = wh.computeStoreHealth('B', { wlDirs: ['/tmp/does-not-exist-wh'], bSourceCount: 500 });
  expect(health.coverage_ratio).toBe(0);
  expect(health.entry_count).toBe(0);
});

// ── AC2 classify thresholds ──

test('classify: healthy store is ok', () => {
  expect(wh.classify({ store: 'A', coverage_ratio: 1, stale_ratio: 0, consistency_errors: 0, source_count: 10 }).level).toBe('ok');
});

test('classify: coverage below floor / stale above ceiling / any consistency error = advisory', () => {
  expect(wh.classify({ store: 'A', coverage_ratio: 0.9, stale_ratio: 0, consistency_errors: 0, source_count: 10 }).level).toBe('advisory');
  expect(wh.classify({ store: 'A', coverage_ratio: 1, stale_ratio: 0.2, consistency_errors: 0, source_count: 10 }).level).toBe('advisory');
  expect(wh.classify({ store: 'A', coverage_ratio: 1, stale_ratio: 0, consistency_errors: 3, source_count: 10 }).level).toBe('advisory');
});

test('AC2/AC4: coverage 0 while source_count > 0 = Tier-2 wiki-store-empty-or-stale', () => {
  const verdict = wh.classify({ store: 'B', coverage_ratio: 0, stale_ratio: 0, consistency_errors: 0, source_count: 1100 });
  expect(verdict.level).toBe('tier-2');
  expect(verdict.pattern_id).toBe('wiki-store-empty-or-stale');
});

// ── AC3 promotion (replay-eval-gated) ──

test('promotionDecision: required at/above 0.85, advisory below, auto-revoking', () => {
  expect(wh.promotionDecision(0.9).gate).toBe('required');
  expect(wh.promotionDecision(0.85).gate).toBe('required');
  expect(wh.promotionDecision(0.84).gate).toBe('advisory');
  expect(wh.promotionDecision(0.7)).toMatchObject({ gate: 'advisory', promotionEligible: false });
});

// ── AC1 emit + AC3 gate-state ──

test('emit: produces a schema-v3 event tagged with goal G8 + the metrics', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wh-ev-')), 'events.jsonl');
  const health = wh.computeStoreHealth('B', { wlDirs: [mkStore([fresh()])] });
  const event = wh.emit(health, wh.classify(health), '2026-06-19T00:00:00Z', file);
  expect(event).toMatchObject({ version: 3, service: 'wiki-health', goal: 'G8', store: 'B' });
  expect(fs.readFileSync(file, 'utf8')).toContain('"goal":"G8"');
});

test('writeGateState: persists the versioned promotion decision', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wh-gs-')), 'state.json');
  const state = wh.writeGateState(wh.promotionDecision(0.9), '2026-06-19T00:00:00Z', file);
  expect(state).toMatchObject({ schema: 'wiki-drift-gate-state-v1', gate: 'required' });
  expect(JSON.parse(fs.readFileSync(file, 'utf8')).gate).toBe('required');
});

// ── AC4 regression: the exact 2026-06-16 condition (A AND B empty, pipeline failing) ──

test('AC4: run() with both stores empty + sources trips Tier-2 incidents for A and B', () => {
  const report = wh.run({
    wlDirs: ['/tmp/none-b'], bSourceCount: 1100,
    eventsFile: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wh-ac4-')), 'e.jsonl'),
  });
  const bIncident = report.incidents.find((i) => i.store === 'B');
  expect(bIncident).toBeTruthy();
  expect(bIncident.pattern_id).toBe('wiki-store-empty-or-stale');
  expect(report.worst).toBe('tier-2');
});
