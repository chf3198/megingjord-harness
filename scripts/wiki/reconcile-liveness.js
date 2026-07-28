#!/usr/bin/env node
'use strict';
// #3759 (Epic #3719): wiki reconcile liveness SLO — "≥1 successful wiki-reconcile-cron run per 24h".
// The 5 prior wiki rot cycles all failed the SAME way: the reconcile stopped succeeding and NOBODY noticed
// (the #3718 alarm wrote to the gitignored dashboard/events.jsonl, so it self-silenced). This monitor reads
// the GitHub Actions run-history — a DURABLE, non-gitignored source of truth that cannot self-silence — and
// HARD-FAILS (a required signal, no precision/corpus dependency) + files a deduped durable issue alert when
// the SLO is breached. checkLiveness is pure for unit testing.
const { execSync } = require('child_process');

const WINDOW_HOURS = 24;
const HOUR_MS = 3600 * 1000;

/**
 * Is there ≥1 successful run within the liveness window?
 * @param {Array<{conclusion: string, createdAt?: string, created_at?: string}>} runs - Actions run records
 * @param {number} nowMs - current epoch ms (injected for determinism)
 * @param {number} [windowHours] - liveness window (default 24h)
 * @returns {{ok: boolean, stale: boolean, reason: string, ageHours: number|null, lastSuccessAt: string|null, totalRuns: number}}
 */
function checkLiveness(runs, nowMs, windowHours = WINDOW_HOURS) {
  const list = Array.isArray(runs) ? runs : [];
  const successes = list
    .filter((r) => r && r.conclusion === 'success')
    .map((r) => ({ at: r.createdAt || r.created_at, ms: Date.parse(r.createdAt || r.created_at) }))
    .filter((r) => Number.isFinite(r.ms))
    .sort((a, b) => b.ms - a.ms);
  if (successes.length === 0) {
    return { ok: false, stale: true, reason: 'no-successful-run', ageHours: null, lastSuccessAt: null, totalRuns: list.length };
  }
  const ageHours = (nowMs - successes[0].ms) / HOUR_MS;
  const ok = ageHours <= windowHours;
  return { ok, stale: !ok, reason: ok ? 'live' : 'stale', ageHours: +ageHours.toFixed(2), lastSuccessAt: successes[0].at, totalRuns: list.length };
}

module.exports = { checkLiveness, WINDOW_HOURS };

if (require.main === module) {
  const workflow = process.env.LIVENESS_WORKFLOW || 'wiki-reconcile-cron.yml';
  let runs = [];
  try {
    runs = JSON.parse(execSync(`gh run list --workflow=${workflow} --json conclusion,createdAt,status -L 40`, { encoding: 'utf-8' }));
  } catch (e) { console.error(`liveness: gh run list failed: ${e.message}`); process.exit(1); }
  const res = checkLiveness(runs, Date.now());
  console.log(`wiki-reconcile-liveness: ${JSON.stringify(res)}`);
  if (res.ok) { console.log(`liveness OK — last success ${res.ageHours}h ago.`); process.exit(0); }
  // durable, non-gitignored sink: a deduped GitHub issue. Fail-open on the alert call, hard-fail the job.
  const title = 'wiki-reconcile liveness SLO breached — no successful reconcile in 24h';
  const body = `The wiki-reconcile-cron SLO ("≥1 successful run / 24h") is breached (${res.reason}; last success `
    + `${res.lastSuccessAt || 'never'}). Wiki B/A upkeep will freeze until fixed. Refs #3759 #3719.`;
  try {
    const existing = execSync(`gh issue list --state open --search ${JSON.stringify(`"${title}" in:title`)} --json number --jq '.[0].number // empty'`, { encoding: 'utf-8' }).trim();
    if (existing) execSync(`gh issue comment ${existing} --body ${JSON.stringify('Recurrence: liveness still stale — ' + res.reason)}`);
    else execSync(`gh issue create --title ${JSON.stringify(title)} --label "type:bug,priority:P1,area:knowledge,status:backlog" --body ${JSON.stringify(body)}`);
  } catch (e) { console.error(`liveness: durable alert failed (job still hard-fails): ${e.message}`); }
  console.error('liveness SLO BREACHED — hard-failing (required signal).');
  process.exit(1);
}
