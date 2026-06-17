#!/usr/bin/env node
// scripts/wiki/reconcile.js — daily local-first catch-all reconciliation for the
// Three-Wiki stores (#3067, Epic #3063). Repairs anything a missed/failed wiki event
// left stale; NEVER a silent no-op. Wiki A is reconciled from LOCAL git (git show
// HEAD:path, no network); Wiki B against gh truth with a checksum-validated cache
// fallback. Emits schema-v3 audit events; escalates Tier-1/Tier-2 via the cache ladder.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const matter = require('gray-matter');

const { ingestCode } = require('./ingest-code');
const { mirrorIssue } = require('./mirror-issue');
const { buildPage } = require('./backfill-work-log');
const { emitV3 } = require('../global/event-schema-v3');

const ROOT = path.join(__dirname, '../..');
const CODE_DIR = path.join(ROOT, 'wiki', 'code');
const TICKETS_DIR = path.join(ROOT, 'wiki', 'work-log', 'tickets');
const CACHE_FILE = path.join(ROOT, 'wiki', 'archive', 'cache', 'work-log-cache.json');
const EVENTS_FILE = path.join(ROOT, 'dashboard', 'events.jsonl');
const INCIDENTS_FILE = path.join(os.homedir(), '.megingjord', 'incidents.jsonl');
const MS_PER_HOUR = 60 * 60 * 1000;
const FRESH_MS = 24 * MS_PER_HOUR;
const STALE_MS = 48 * MS_PER_HOUR;
const SUMMARY_MAX = 200;

function sha256Hex(text) { return crypto.createHash('sha256').update(text).digest('hex'); }

// Defense in depth: only mirror-derived, repo-relative source paths reach `git show`.
function isSafeRepoPath(rel) {
  return typeof rel === 'string' && rel.length > 0
    && !rel.startsWith('/') && !rel.split('/').includes('..');
}

// Canonical (sorted-key) serialization so the cache checksum is order-independent.
function canonical(entries) {
  const sorted = {};
  for (const key of Object.keys(entries).sort((a, b) => Number(a) - Number(b))) sorted[key] = entries[key];
  return JSON.stringify(sorted);
}

/** Append a Tier-N anneal incident (never silent — AC2). */
function emitIncident(tier, patternId, summary) {
  fs.mkdirSync(path.dirname(INCIDENTS_FILE), { recursive: true });
  const ev = {
    ts: new Date().toISOString(), version: 'v3', tier, service: 'wiki-reconcile',
    env: process.env.CI ? 'ci' : 'local', event: 'anneal', trigger_role: 'admin',
    trigger_type: 'reconcile', pattern_id: patternId, severity: tier === 'tier-2' ? 'high' : 'low',
    _summary: String(summary).slice(0, SUMMARY_MAX),
  };
  fs.appendFileSync(INCIDENTS_FILE, JSON.stringify(ev) + '\n');
}

/** Emit a schema-v3 audit event to dashboard/events.jsonl (AC3). */
function emitAudit(event, extra) {
  emitV3({
    ts: new Date().toISOString(), version: 3, service: 'wiki-reconcile',
    env: process.env.CI ? 'ci' : 'local', event, ...extra,
  }, EVENTS_FILE);
}

/** sha256 of the committed source at HEAD (no network) or null if the path is gone. */
function headSourceSha(sourcePath) {
  if (!isSafeRepoPath(sourcePath)) return null; // reject traversal/absolute before git show
  try {
    return sha256Hex(execFileSync('git', ['show', `HEAD:${sourcePath}`], { encoding: 'utf8' }));
  } catch { return null; }
}

function listPages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listPages(full);
    return e.name.endsWith('.md') ? [full] : [];
  });
}

/**
 * Reconcile Wiki A from local git (AC1). A page is stale when its source_sha256 no
 * longer matches sha256(git show HEAD:source_path). Repair re-ingests from HEAD.
 * @param {{dryRun?:boolean, codeDir?:string}} [opts]
 */
function reconcileA(opts = {}) {
  const dir = opts.codeDir || CODE_DIR;
  const drifted = [];
  for (const page of listPages(dir)) {
    const fm = matter(fs.readFileSync(page, 'utf8')).data;
    if (!fm.source_path) continue;
    const headSha = headSourceSha(fm.source_path);
    if (headSha === null) { drifted.push(fm.source_path); continue; } // source removed
    if (headSha !== fm.source_sha256) drifted.push(fm.source_path);
  }
  let repaired = [];
  if (drifted.length && !opts.dryRun) {
    repaired = ingestCode({ wikiCodeDir: dir, runId: opts.runId || 'reconcile' }).map((r) => r.slug);
  }
  return { layer: 'A', checked: listPages(dir).length, drifted, repaired };
}

/** Read the checksum-validated work-log cache, or null when missing/corrupt. */
function readCache(cacheFile) {
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (raw.checksum !== sha256Hex(canonical(raw.entries))) return null; // tamper/corrupt
    return raw;
  } catch { return null; }
}

function writeCache(cacheFile, entries) {
  const raw = { generated_at: new Date().toISOString(), entries, checksum: sha256Hex(canonical(entries)) };
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(raw, null, 2));
}

function ghIssue(number) {
  const out = execFileSync('gh', ['issue', 'view', String(number), '--json',
    'number,title,state,body,labels,updatedAt'], { encoding: 'utf8' });
  return JSON.parse(out);
}

/**
 * Resolve Wiki B truth for one ticket: live gh first, else the cache ladder (AC2).
 * @param {Function} [fetchIssue] injectable gh fetcher (tests pass a stub / outage simulator)
 * @returns {{source:'gh'|'cache'|'none', sha?:string, item?:object, tier?:string, cacheAgeMs?:number}}
 */
function resolveBTruth(number, cache, fetchIssue = ghIssue) {
  try {
    const item = fetchIssue(number);
    return { source: 'gh', sha: sha256Hex(JSON.stringify(item)), item };
  } catch {
    if (!cache || !cache.entries[number]) return { source: 'none', tier: 'tier-2' };
    const ageMs = Date.now() - new Date(cache.generated_at).getTime();
    const tier = ageMs < FRESH_MS ? 'tier-1' : 'tier-2';
    return { source: 'cache', sha: cache.entries[number], tier, cacheAgeMs: ageMs };
  }
}

/**
 * Reconcile Wiki B against gh truth, falling back to the validated cache (AC1/AC2).
 * @param {{dryRun?:boolean, ticketsDir?:string, cacheFile?:string}} [opts]
 */
function reconcileB(opts = {}) {
  const dir = opts.ticketsDir || TICKETS_DIR;
  const cacheFile = opts.cacheFile || CACHE_FILE;
  const cache = readCache(cacheFile);
  const drifted = []; const repaired = []; const freshEntries = {};
  let cacheUsed = 0; let worstTier = null; let maxCacheAge = 0;
  for (const page of listPages(dir)) {
    const num = Number(path.basename(page, '.md'));
    if (!Number.isInteger(num)) continue;
    const fm = matter(fs.readFileSync(page, 'utf8')).data;
    const truth = resolveBTruth(num, cache, opts.fetchIssue);
    if (truth.source === 'cache') {
      cacheUsed += 1; maxCacheAge = Math.max(maxCacheAge, truth.cacheAgeMs || 0);
      worstTier = truth.tier === 'tier-2' ? 'tier-2' : (worstTier || 'tier-1');
    }
    if (truth.source === 'none') { worstTier = 'tier-2'; drifted.push(num); continue; }
    if (truth.sha) freshEntries[num] = truth.sha;
    if (truth.sha !== fm.source_sha256) {
      drifted.push(num);
      if (truth.item && !opts.dryRun) { mirrorIssue(num, { item: truth.item, ticketsDir: dir }); repaired.push(num); }
    }
  }
  if (Object.keys(freshEntries).length && !opts.dryRun) writeCache(cacheFile, freshEntries);
  return { layer: 'B', checked: listPages(dir).length, drifted, repaired, cacheUsed, tier: worstTier, maxCacheAgeMs: maxCacheAge };
}

/** Run both layers, emit audit events + ladder incidents. Never a silent no-op (AC2/AC3). */
function reconcile(opts = {}) {
  const resultA = reconcileA(opts);
  const resultB = reconcileB(opts);
  emitAudit('reconcile-complete', {
    repaired: [...resultA.repaired.map((slug) => `A:${slug}`), ...resultB.repaired.map((num) => `B:#${num}`)],
    drift_delta: resultA.drifted.length + resultB.drifted.length,
    cache_used: resultB.cacheUsed, reconcile_error_rate: 0,
    _summary: `A drift ${resultA.drifted.length}, B drift ${resultB.drifted.length}, cache_used ${resultB.cacheUsed}`,
  });
  if (resultB.tier === 'tier-2') emitIncident('tier-2', 'wiki-reconcile-stale-cache-or-both-fail',
    `Wiki B reconcile escalated: cache_used ${resultB.cacheUsed}, maxCacheAge ${Math.round(resultB.maxCacheAgeMs / MS_PER_HOUR)}h`);
  else if (resultB.tier === 'tier-1') emitIncident('tier-1', 'wiki-reconcile-fresh-cache-fallback',
    `Wiki B served fresh cache for ${resultB.cacheUsed} ticket(s)`);
  return { a: resultA, b: resultB, servedStaticArchive: resultB.maxCacheAgeMs > STALE_MS };
}

module.exports = {
  reconcile, reconcileA, reconcileB, resolveBTruth, readCache, writeCache,
  emitAudit, emitIncident, FRESH_MS, STALE_MS,
};

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const res = reconcile({ dryRun });
  console.log(`reconcile: A drift=${res.a.drifted.length} repaired=${res.a.repaired.length} | ` +
    `B drift=${res.b.drifted.length} repaired=${res.b.repaired.length} cache_used=${res.b.cacheUsed} tier=${res.b.tier || 'none'}`);
}
