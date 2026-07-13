#!/usr/bin/env node
'use strict';
// #3765 (Epic #3719 capstone): the dev→test iterative-proof loop that shows wiki upkeep HOLDS across N=5
// reconcile cycles — the "sustained proof" every prior wiki generation lacked (each shipped once, then rotted).
// Measures the FRESH wiki-mirror work-log health (via wiki-health-detector, reused) each cycle, appends a
// record to the committed non-gitignored proof-log (cannot self-silence), and asserts the last N cycles all
// clear coverage>=0.95 & staleness<=0.10. N=5 is a REPLAY-EVAL COUNT that accrues over cycles (anti-calendar,
// #2983) — not a wall-clock window. checkSustained is pure for unit testing.
const path = require('path');
const fs = require('fs');
const { computeStoreHealth, COVERAGE_FLOOR, STALE_CEILING } = require('./wiki-health-detector');
const { ensureMirrorCache } = require('./mirror-source');

const N_CYCLES = 5;
const PROOF_LOG = path.resolve(__dirname, '../../governance/wiki-sustained-proof.jsonl');

/**
 * Does the wiki upkeep HOLD across the last N cycles? (pure)
 * @param {Array<{coverage_ratio: number, stale_ratio: number, ok?: boolean}>} cycles - recorded cycle metrics
 * @param {{n?: number, coverageFloor?: number, stalenessCeil?: number}} [opts]
 * @returns {{sustained: boolean, recorded: number, needed: number, trailingPassing: number, anyFailingInWindow: boolean}}
 */
function checkSustained(cycles, opts = {}) {
  const n = opts.n || N_CYCLES;
  const floor = opts.coverageFloor ?? COVERAGE_FLOOR;
  const ceil = opts.stalenessCeil ?? STALE_CEILING;
  const list = Array.isArray(cycles) ? cycles : [];
  const passes = (c) => c && c.coverage_ratio >= floor && c.stale_ratio <= ceil;
  const window = list.slice(-n);
  let trailing = 0;
  for (let i = list.length - 1; i >= 0 && passes(list[i]); i--) trailing += 1;
  return {
    sustained: list.length >= n && window.every(passes),
    recorded: list.length, needed: n, trailingPassing: trailing,
    anyFailingInWindow: window.length > 0 && !window.every(passes),
  };
}

function measureCycle(nowMs) {
  const wikiPath = ensureMirrorCache(); // fresh wiki-mirror surface (or null → local fallback)
  const base = wikiPath || path.resolve(__dirname, '../../wiki');
  const wlDirs = [path.join(base, 'work-log', 'tickets'), path.join(base, 'work-log', 'prs')];
  const h = computeStoreHealth('B', { wlDirs, nowMs });
  return {
    coverage_ratio: h.coverage_ratio, stale_ratio: h.stale_ratio, entry_count: h.entry_count,
    surface: wikiPath ? 'wiki-mirror' : 'local', ok: h.coverage_ratio >= COVERAGE_FLOOR && h.stale_ratio <= STALE_CEILING,
  };
}

function readLog() {
  try { return fs.readFileSync(PROOF_LOG, 'utf-8').trim().split('\n').filter(Boolean).map(JSON.parse); } catch { return []; }
}

module.exports = { checkSustained, measureCycle, readLog, N_CYCLES, PROOF_LOG };

if (require.main === module) {
  const { execSync } = require('child_process');
  const nowIso = process.env.SUSTAINED_NOW || new Date().toISOString();
  const cycle = { ts: nowIso, ...measureCycle(Date.parse(nowIso)) };
  const cycles = readLog().concat(cycle);
  fs.mkdirSync(path.dirname(PROOF_LOG), { recursive: true });
  fs.appendFileSync(PROOF_LOG, JSON.stringify(cycle) + '\n');
  const status = checkSustained(cycles);
  console.log(`wiki-sustained-proof: ${JSON.stringify({ cycle, ...status })}`);
  if (!cycle.ok) { // a FAILING cycle is a real regression — durable alert + hard-fail
    const title = 'wiki upkeep regressed — sustained-proof cycle below the bar';
    const body = `A wiki-sustained-proof cycle failed the bar (coverage ${cycle.coverage_ratio} floor ${COVERAGE_FLOOR}, `
      + `staleness ${cycle.stale_ratio} ceil ${STALE_CEILING}, surface ${cycle.surface}). Refs #3765 #3719.`;
    try {
      const ex = execSync(`gh issue list --state open --search ${JSON.stringify(`"${title}" in:title`)} --json number --jq '.[0].number // empty'`, { encoding: 'utf-8' }).trim();
      if (ex) execSync(`gh issue comment ${ex} --body ${JSON.stringify('Recurrence: cycle still below the bar.')}`);
      else execSync(`gh issue create --title ${JSON.stringify(title)} --label "type:bug,priority:P1,area:knowledge,status:backlog" --body ${JSON.stringify(body)}`);
    } catch (e) { console.error(`sustained-proof: alert failed (job still hard-fails): ${e.message}`); }
    console.error('sustained-proof: current cycle BELOW the bar — hard-failing.'); process.exit(1);
  }
  console.log(status.sustained ? `SUSTAINED: last ${status.needed} cycles hold.` : `accruing: ${status.trailingPassing}/${status.needed} trailing cycles pass (current cycle OK).`);
  process.exit(0);
}
