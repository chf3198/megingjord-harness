#!/usr/bin/env node
// wiki-health-detector (#3068, Epic #3063 — the anti-recurrence core). Aggregates the
// existing wiki modules into a per-store (A=code, B=work-log) health vector and makes
// "wiki empty or stale" impossible to miss again (the 2026-06-16 meta-failure: both
// stores empty + the pipeline silently failing). Pure + deterministic (no gh/provider
// calls — source counts are injectable so it stays zero-cost and testable).
//
// 2026 grounding: knowledge-store staleness is "operationally invisible" unless measured;
// the six data-quality dimensions (completeness/timeliness/consistency/accuracy) map onto
// coverage_ratio / stale_ratio / consistency_errors / reconcile_error_rate; the guardrail
// consensus is advisory-until-precision-calibrated, then blocking (mirrors the #3105
// test-floor replay-eval promotion). See the Epic for citations.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { detectCodeDrift } = require('./drift-detector');
const { parseFrontmatter } = require('./wiki-io');

const ROOT = path.resolve(__dirname, '..', '..');
const WIKI = path.join(ROOT, 'wiki');
const SRC_DIRS = [{ dir: path.join(ROOT, 'scripts/global'), re: /\.js$/ }, { dir: path.join(ROOT, 'instructions'), re: /\.md$/ }];
const SYM_DIR = path.join(WIKI, 'code', 'symbols');
const WL_DIRS = [path.join(WIKI, 'work-log', 'tickets'), path.join(WIKI, 'work-log', 'prs')];
const EVENTS_FILE = path.join(ROOT, 'dashboard', 'events.jsonl');
const GATE_STATE_FILE = path.join(ROOT, 'generated', 'wiki-drift-gate-state.json');

// AC2 thresholds + AC3 promotion bar.
const COVERAGE_FLOOR = 0.95;
const STALE_CEILING = 0.10;
const PROMOTION_PRECISION = 0.85;

function countFiles(dir, re = /\.md$/) {
  try { return fs.readdirSync(dir).filter((name) => re.test(name)).length; } catch { return 0; }
}
function countSources(dirs) {
  return dirs.reduce((total, { dir, re }) => total + countFiles(dir, re), 0);
}
function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : (numerator > 0 ? 0 : 1);
}

// Wiki B (work-log) mirrors GitHub tickets/PRs — its entries have NO repo-file source, so
// the code-symbol drift logic does not apply. B health = is it populated (coverage), are
// mirrors past their freshness window (stale), and do entries carry required frontmatter
// (consistency). Computed from the filesystem + a frontmatter pass (deterministic via now).
// The fields a healthy work-log mirror entry must carry (the backfill schema).
const REQUIRED_B_FIELDS = ['type', 'last_updated', 'source_path'];
// Mirror-liveness window: if the NEWEST work-log entry is older than this, the mirror
// pipeline has stalled (the 2026-06-16 failure) — entry-age would false-positive on
// old-but-correct closed-ticket mirrors, so liveness is the right staleness signal.
const MIRROR_LIVENESS_DAYS = 14;
const MS_PER_DAY = 86400000;

function listMdFiles(dirs) {
  return dirs.flatMap((dir) => {
    try { return fs.readdirSync(dir).filter((name) => name.endsWith('.md') && name !== 'README.md').map((name) => path.join(dir, name)); }
    catch { return []; }
  });
}

/**
 * Compute the health vector for one store.
 * @param {'A'|'B'} store code (A) or work-log (B).
 * @param {{bSourceCount?: number, reconcileErrorRate?: number, actionsMinutes?: number}} [opts]
 * @returns {object} per-store health metrics.
 */
function computeStoreHealth(store, opts = {}) {
  const base = { reconcile_error_rate: opts.reconcileErrorRate ?? 0, actions_minutes: opts.actionsMinutes ?? null };
  return store === 'A' ? healthA(base) : healthB(base, opts);
}

// Wiki A (code): symbols ↔ source files — coverage + content-hash staleness via drift-detector.
function healthA(base) {
  const drift = detectCodeDrift();
  const sourceCount = countSources(SRC_DIRS);
  const entryCount = countFiles(SYM_DIR);
  return {
    store: 'A', source_count: sourceCount, entry_count: entryCount,
    coverage_ratio: ratio(sourceCount - drift.uncovered.length, sourceCount),
    stale_ratio: ratio(drift.stale.length, entryCount),
    consistency_errors: drift.orphans.length, ...base,
  };
}

// Wiki B (work-log): GitHub-ticket/PR mirrors — coverage (populated vs source_count, injectable
// so no gh call), consistency (required frontmatter), staleness (mirror-liveness, not entry age).
function healthB(base, opts) {
  const files = listMdFiles(opts.wlDirs || WL_DIRS);
  const entryCount = files.length;
  const sourceCount = opts.bSourceCount ?? entryCount;
  const nowMs = opts.nowMs ?? Date.now();
  let consistency = 0; let newestUpdate = 0;
  for (const file of files) {
    const { frontmatter } = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
    if (!REQUIRED_B_FIELDS.every((field) => frontmatter[field])) { consistency += 1; continue; }
    const updated = Date.parse(frontmatter.last_updated);
    if (!Number.isNaN(updated) && updated > newestUpdate) newestUpdate = updated;
  }
  const mirrorStalled = entryCount > 0 && (newestUpdate === 0 || nowMs - newestUpdate > MIRROR_LIVENESS_DAYS * MS_PER_DAY);
  return {
    store: 'B', source_count: sourceCount, entry_count: entryCount,
    coverage_ratio: entryCount === 0 && sourceCount > 0 ? 0 : ratio(Math.min(entryCount, sourceCount), sourceCount),
    stale_ratio: mirrorStalled ? 1 : 0, consistency_errors: consistency, ...base,
  };
}

/**
 * Classify a store's health per AC2 (advisory vs Tier-2 incident).
 * @param {object} health a computeStoreHealth() result.
 * @returns {{level: 'ok'|'advisory'|'tier-2', reasons: string[], pattern_id: string|null}}
 */
function classify(health) {
  const reasons = [];
  // AC2 Tier-2: store empty while its sources exist — the 2026-06-16 meta-failure.
  if (health.coverage_ratio === 0 && health.source_count > 0) {
    return { level: 'tier-2', reasons: [`store ${health.store} empty (coverage 0) while source_count=${health.source_count}`], pattern_id: 'wiki-store-empty-or-stale' };
  }
  if (health.coverage_ratio < COVERAGE_FLOOR) reasons.push(`coverage_ratio ${health.coverage_ratio} below ${COVERAGE_FLOOR}`);
  if (health.stale_ratio > STALE_CEILING) reasons.push(`stale_ratio ${health.stale_ratio} above ${STALE_CEILING}`);
  if (health.consistency_errors > 0) reasons.push(`${health.consistency_errors} consistency_error(s)`);
  return { level: reasons.length ? 'advisory' : 'ok', reasons, pattern_id: null };
}

/**
 * AC3: replay-eval-gated promotion of the #2058 wiki-drift gate (advisory <-> required).
 * @param {number} precision replay-eval mean precision vs the historical-PR corpus.
 * @returns {{gate: 'required'|'advisory', precision: number, promotionEligible: boolean}}
 */
function promotionDecision(precision) {
  const promotionEligible = Number(precision) >= PROMOTION_PRECISION;
  return { gate: promotionEligible ? 'required' : 'advisory', precision: Number(precision), promotionEligible };
}

/**
 * AC1 emit: append a schema-v3 event per store to dashboard/events.jsonl, tagged with the
 * G8 goal so the Goal-coverage panel counts it as an observability signal. Impure (ts/IO).
 * @param {object} health a computeStoreHealth() result.
 * @param {{level: string, reasons: string[], pattern_id: string|null}} verdict classify() output.
 * @param {string} [ts] ISO timestamp (default now).
 * @returns {object} the emitted event.
 */
function emit(health, verdict, ts = new Date().toISOString(), eventsFile = EVENTS_FILE) {
  const event = {
    ts, version: 3, service: 'wiki-health', env: process.env.CI ? 'ci' : 'local',
    event: 'wiki-health-check', trigger_role: 'system', goal: 'G8', goals: ['G8'],
    store: health.store, level: verdict.level, pattern_id: verdict.pattern_id,
    coverage_ratio: health.coverage_ratio, stale_ratio: health.stale_ratio,
    consistency_errors: health.consistency_errors, reconcile_error_rate: health.reconcile_error_rate,
    actions_minutes: health.actions_minutes, source_count: health.source_count, entry_count: health.entry_count,
    _summary: `Wiki ${health.store}: coverage ${health.coverage_ratio}, stale ${health.stale_ratio}, ${verdict.level}`,
  };
  try { fs.mkdirSync(path.dirname(eventsFile), { recursive: true }); fs.appendFileSync(eventsFile, `${JSON.stringify(event)}\n`); } catch { /* best-effort */ }
  return event;
}

/** AC3: persist the gate-promotion decision the wiki-drift workflow reads (advisory unless required). */
function writeGateState(decision, ts = new Date().toISOString(), gateStateFile = GATE_STATE_FILE) {
  const state = { schema: 'wiki-drift-gate-state-v1', ts, ...decision };
  try { fs.mkdirSync(path.dirname(gateStateFile), { recursive: true }); fs.writeFileSync(gateStateFile, `${JSON.stringify(state, null, 2)}\n`); } catch { /* best-effort */ }
  return state;
}

/**
 * Run the detector across both stores: compute, classify, emit. Never a silent no-op.
 * @param {object} [opts] injectables (bSourceCount, reconcileErrorRate, actionsMinutes, replayPrecision, ts).
 * @returns {{stores: object[], worst: string, incidents: object[]}}
 */
function run(opts = {}) {
  const ts = opts.ts || new Date().toISOString();
  const order = { ok: 0, advisory: 1, 'tier-2': 2 };
  const stores = []; const incidents = [];
  for (const store of ['A', 'B']) {
    const health = computeStoreHealth(store, opts);
    const verdict = classify(health);
    emit(health, verdict, ts, opts.eventsFile);
    if (verdict.level === 'tier-2') incidents.push({ store, pattern_id: verdict.pattern_id, reasons: verdict.reasons });
    stores.push({ ...health, ...verdict });
  }
  const worst = stores.reduce((acc, s) => (order[s.level] > order[acc] ? s.level : acc), 'ok');
  if (opts.replayPrecision !== undefined) writeGateState(promotionDecision(opts.replayPrecision), ts, opts.gateStateFile);
  return { stores, worst, incidents };
}

function runCli(argv) {
  const num = (flag) => { const hit = argv.find((a) => a.startsWith(`${flag}=`)); return hit ? Number(hit.split('=')[1]) : undefined; };
  const report = run({ bSourceCount: num('--b-sources'), replayPrecision: num('--precision'), actionsMinutes: num('--actions-minutes') });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return report.incidents.length && argv.includes('--strict') ? 2 : 0;
}

if (require.main === module) { process.exit(runCli(process.argv.slice(2))); }

module.exports = {
  COVERAGE_FLOOR, STALE_CEILING, PROMOTION_PRECISION, EVENTS_FILE, GATE_STATE_FILE,
  countFiles, countSources, ratio, computeStoreHealth, classify, promotionDecision,
  emit, writeGateState, run, runCli,
};
