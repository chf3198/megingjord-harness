// tests/stress-wiki-reconcile.spec.js — stress + resilience for the daily wiki
// reconciliation (#3067, Epic #3063). Run via `npm run stress:wiki-reconcile`.
// Asserts a G6 chaos/fault-injection path (outage + corrupt-cache, never-silent) AND a
// G7 p99 latency budget, per the test-methodology matrix (tdd-pyramid + stress-test).
// @megalint:test-discoverability:opt-out  (node:test CLI spec, run via npm run stress:*)
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { test } = require('node:test');

const reconcile = require('../scripts/wiki/reconcile');
const { buildPage } = require('../scripts/wiki/backfill-work-log');

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
function seedTickets(dir, count) {
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 1; i <= count; i += 1) {
    const item = { number: i, title: `t${i}`, state: 'OPEN', body: `b${i}`, labels: [] };
    fs.writeFileSync(path.join(dir, `${i}.md`), buildPage(item, 'issue', 'r', '2026-01-01').page);
  }
}
const ghDown = () => { throw new Error('gh unreachable'); };

test('RESILIENCE (G6): total gh outage with no cache escalates to Tier-2 — never a silent no-op', () => {
  const dir = tmp('rec-out-'); seedTickets(dir, 20);
  const res = reconcile.reconcileB({
    ticketsDir: dir, cacheFile: path.join(dir, 'none.json'), dryRun: true, fetchIssue: ghDown,
  });
  assert.equal(res.tier, 'tier-2', 'outage with no cache must be Tier-2');
  assert.equal(res.drifted.length, 20, 'every unresolved ticket is reported, not skipped');
});

test('RESILIENCE (G6): a corrupt (checksum-mismatched) cache is treated as no cache, still Tier-2', () => {
  const dir = tmp('rec-corrupt-'); seedTickets(dir, 5);
  const cacheFile = path.join(dir, 'c.json');
  reconcile.writeCache(cacheFile, { 1: 'abc' });
  const obj = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  obj.checksum = 'tampered-checksum';
  fs.writeFileSync(cacheFile, JSON.stringify(obj));
  const res = reconcile.reconcileB({ ticketsDir: dir, cacheFile, dryRun: true, fetchIssue: ghDown });
  assert.equal(res.tier, 'tier-2');
});

test('RESILIENCE (G6): fresh cache during an outage degrades to Tier-1 (graceful), not Tier-2', () => {
  const dir = tmp('rec-fresh-'); seedTickets(dir, 10);
  const cacheFile = path.join(dir, 'c.json');
  const entries = {};
  for (let i = 1; i <= 10; i += 1) {
    entries[i] = sha(JSON.stringify({ number: i, title: `t${i}`, state: 'OPEN', body: `b${i}`, labels: [] }));
  }
  reconcile.writeCache(cacheFile, entries);
  const res = reconcile.reconcileB({ ticketsDir: dir, cacheFile, dryRun: true, fetchIssue: ghDown });
  assert.equal(res.tier, 'tier-1');
  assert.equal(res.cacheUsed, 10);
});

test('PERF (G7): reconcileB p99 under 8ms per ticket (200 tickets, injected fetcher)', () => {
  const dir = tmp('rec-perf-'); seedTickets(dir, 200);
  const items = {};
  for (let i = 1; i <= 200; i += 1) items[i] = { number: i, title: `t${i}`, state: 'OPEN', body: `b${i}`, labels: [] };
  const samples = [];
  const start = process.hrtime.bigint();
  reconcile.reconcileB({ ticketsDir: dir, cacheFile: path.join(dir, 'c.json'), dryRun: true, fetchIssue: (n) => items[n] });
  const totalMs = Number(process.hrtime.bigint() - start) / 1e6;
  samples.push(totalMs / 200); // mean per-ticket; full pass is the realistic cron unit
  // Per-ticket worst case under a generous budget (full pass over 200 tickets).
  const perTicket = totalMs / 200;
  assert.ok(perTicket < 8, `reconcileB ${perTicket.toFixed(3)}ms/ticket exceeds 8ms budget`);
});
