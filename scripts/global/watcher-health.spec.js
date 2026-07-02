#!/usr/bin/env node
'use strict';
// watcher-health.spec.js (#3522) — fixture self-test (#1893). Feeds synthetic API shapes for all
// four D1 signatures + healthy control + edge cases (zero-workflow repo, archived repo,
// allow-list suppression, stale-allowlist orphan). Pure — no network. Guards the monitor against
// silently breaking (the copilot-global-skills#1 failure mode this Epic exists to eliminate).
const assert = require('node:assert');
const { scheduleIntervalMs, classifyRuns, classifyWorkflow, buildReport } = require('./watcher-health');

const NOW = Date.UTC(2026, 6, 1, 12, 0, 0); // fixed clock — deterministic
const F = c => ({ conclusion: c, created_at: new Date(NOW - 3600e3).toISOString() });
const recent = { conclusion: 'success', created_at: new Date(NOW - 3600e3).toISOString() };

// --- scheduleIntervalMs ---
assert.strictEqual(scheduleIntervalMs('*/15 * * * *'), 15 * 60e3, 'every-15-min');
assert.strictEqual(scheduleIntervalMs('17 */6 * * *'), 6 * 3600e3, 'every-6-hour');
assert.strictEqual(scheduleIntervalMs('0 6 * * *'), 24 * 3600e3, 'daily');
assert.strictEqual(scheduleIntervalMs('0 6 * * 1'), 7 * 24 * 3600e3, 'weekly');
assert.strictEqual(scheduleIntervalMs('0 0 */2 * *'), 2 * 24 * 3600e3, 'every-2-days (mistral R1 fix)');
assert.strictEqual(scheduleIntervalMs('0 6 1 * *'), 30 * 24 * 3600e3, 'monthly (specific dom)');
assert.strictEqual(scheduleIntervalMs(''), 24 * 3600e3, 'malformed→daily');

// --- classifyRuns ---
assert.strictEqual(classifyRuns([F('failure'), F('failure'), F('failure')]), 'failed-since-inception', 'all-fail');
assert.strictEqual(classifyRuns([]), null, 'no-runs→null (not vacuous inception)');
assert.strictEqual(
  classifyRuns([F('failure'), F('failure'), F('failure'), F('success'), F('success')]),
  'n-consecutive-failure', '3-fail-after-success');
assert.strictEqual(classifyRuns([recent, F('failure')]), null, 'healthy-latest→null');

// --- classifyWorkflow: 4 signatures + healthy control ---
assert.strictEqual(classifyWorkflow({ state: 'disabled_inactivity', runs: [recent], cron: '0 6 * * *' }, NOW),
  'auto-disabled-inactivity', 'disabled-inactivity dominates');
assert.strictEqual(classifyWorkflow({ state: 'active', runs: [F('failure'), F('failure'), F('failure')], cron: '0 6 * * *' }, NOW),
  'failed-since-inception', 'inception');
assert.strictEqual(classifyWorkflow({ state: 'active', runs: [F('failure'), F('failure'), F('failure'), F('success')], cron: '0 6 * * *' }, NOW),
  'n-consecutive-failure', 'regression');
const staleRun = { conclusion: 'success', created_at: new Date(NOW - 40 * 3600e3).toISOString() };
assert.strictEqual(classifyWorkflow({ state: 'active', runs: [staleRun], cron: '0 6 * * *' }, NOW),
  'stale-heartbeat', 'dead-man: 40h > 24h+6h buffer');
assert.strictEqual(classifyWorkflow({ state: 'active', runs: [recent], cron: '0 6 * * *' }, NOW),
  null, 'healthy control → no finding');

// --- buildReport: edge cases + allow-list + stale-allowlist + coverage ---
const repos = [
  { repo: 'archived-one', archived: true },
  { repo: 'no-access', readable: false },
  { repo: 'empty', readable: true, workflows: [] },
  { repo: 'healthy', readable: true, workflows: [{ name: 'ok.yml', state: 'active', cron: '0 6 * * *', runs: [recent] }] },
  { repo: 'broken', readable: true, workflows: [{ name: 'audit.yml', state: 'active', cron: '0 6 * * *', runs: [F('failure'), F('failure'), F('failure')] }] },
  { repo: 'suppressed', readable: true, workflows: [{ name: 'deprecated.yml', state: 'disabled_inactivity', cron: '0 6 * * *', runs: [] }] },
];
const allow = { '_note': 'meta key must be ignored', 'suppressed/deprecated.yml': 'deprecated — retired 2026-06', 'gone/removed.yml': 'orphan entry' };
const { findings, coverage } = buildReport(repos, NOW, allow);

// Exactly one finding: the broken audit workflow (copilot-global-skills#1 scenario), triage=true.
assert.strictEqual(findings.length, 1, 'one finding');
assert.deepStrictEqual(
  { r: findings[0].repo, w: findings[0].workflow, s: findings[0].signature, t: findings[0].triage },
  { r: 'broken', w: 'audit.yml', s: 'failed-since-inception', t: true }, 'broken audit surfaced + triage');
assert.strictEqual(coverage.reposScanned, 4, 'archived + no-access excluded from scanned');
assert.strictEqual(coverage.workflowsScanned, 3, 'scheduled workflows counted');
assert.ok(coverage.skipped.some(s => s.reason === 'archived'), 'archived logged');
assert.ok(coverage.skipped.some(s => s.reason === 'partial-coverage'), 'no-access → partial-coverage (never silent)');
assert.ok(coverage.skipped.some(s => String(s.reason).startsWith('allow:')), 'allow-list suppression logged');
assert.ok(coverage.staleAllow.some(o => o.key === 'gone/removed.yml' && o.reason === 'stale-allowlist'), 'orphan allow entry flagged');
assert.ok(!coverage.staleAllow.some(o => o.key === '_note'), '_-prefixed meta key ignored (not an orphan)');

process.stdout.write('watcher-health.spec: PASS (4 signatures + healthy + 3 edge cases + allow-list + stale-allowlist + coverage)\n');
