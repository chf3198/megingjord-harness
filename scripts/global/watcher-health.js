#!/usr/bin/env node
'use strict';
// watcher-health.js (#3522, Epic #3520) — fleet-wide scheduled-workflow health monitor.
// Design: research/adr/020-fleet-observability.md §D1/D3/D4/D5. Pure core is fixture-testable;
// main() does IO via gh. Reuses #2930 circuit-breaker, #3483 content-SHA cache, #546 sink. $0 (G3).
const { execSync } = require('node:child_process');
const cb = require('./circuit-breaker');
const incidents = require('./incidents-store');
const N_CONSECUTIVE = 3, K_MAX = 10, HEARTBEAT_BUFFER_MS = 6 * 3600 * 1000;
const TRIAGE_SIGS = new Set(['failed-since-inception', 'auto-disabled-inactivity']);

// Coarse interval from cron (min hour dom mon dow): */n steps in min/hour/dom, specific dom/month
// → ~monthly, dow → weekly, else daily — so multi-day schedules are not mis-called stale (R1 fix).
function scheduleIntervalMs(cron) {
  const f = String(cron || '').trim().split(/\s+/);
  if (f.length !== 5) return 24 * 3600e3;
  const step = (x, u) => { const m = x.match(/^\*\/(\d+)$/); return m ? +m[1] * u : 0; };
  return step(f[0], 60e3) || step(f[1], 3600e3) || step(f[2], 24 * 3600e3)
    || (f[2] !== '*' || f[3] !== '*' ? 30 * 24 * 3600e3 : f[4] !== '*' ? 7 * 24 * 3600e3 : 24 * 3600e3);
}
// runs newest-first [{conclusion,created_at}] → run-based signature or null.
function classifyRuns(runs) {
  const c = (runs || []).map(r => r.conclusion), K = Math.min(K_MAX, (runs || []).length);
  if (K > 0 && c.slice(0, K).every(x => x === 'failure')) return 'failed-since-inception';
  if (c.length > N_CONSECUTIVE && c.slice(0, N_CONSECUTIVE).every(x => x === 'failure')
      && c.slice(N_CONSECUTIVE).includes('success')) return 'n-consecutive-failure';
  return null;
}
// wf {state,runs,cron}; now epoch ms → single highest-severity signature or null.
function classifyWorkflow(wf, now) {
  if (wf.state === 'disabled_inactivity') return 'auto-disabled-inactivity';
  const runSig = classifyRuns(wf.runs); if (runSig) return runSig;
  const last = (wf.runs || [])[0], lastMs = last ? new Date(last.created_at).getTime() : 0;
  return now - lastMs > scheduleIntervalMs(wf.cron) + HEARTBEAT_BUFFER_MS ? 'stale-heartbeat' : null;
}
// Pure. repos: [{repo,archived,readable,workflows:[{name,state,cron,runs}]}]; allow {"repo/wf":reason}.
function buildReport(repos, now, allow = {}) {
  const findings = [], skipped = [], liveKeys = new Set();
  let reposScanned = 0, workflowsScanned = 0;
  for (const r of repos) {
    if (r.archived) { skipped.push({ repo: r.repo, reason: 'archived' }); continue; }
    if (r.readable === false) { skipped.push({ repo: r.repo, reason: 'partial-coverage' }); continue; }
    reposScanned++;
    for (const wf of (r.workflows || [])) {
      workflowsScanned++; const key = `${r.repo}/${wf.name}`; liveKeys.add(key);
      const sig = classifyWorkflow(wf, now); if (!sig) continue;
      if (allow[key]) { skipped.push({ repo: r.repo, workflow: wf.name, reason: `allow:${allow[key]}` }); continue; }
      findings.push({ repo: r.repo, workflow: wf.name, signature: sig, triage: TRIAGE_SIGS.has(sig) });
    }
  }
  const staleAllow = Object.keys(allow).filter(k => !k.startsWith('_') && !liveKeys.has(k)).map(k => ({ key: k, reason: 'stale-allowlist' }));
  return { findings, coverage: { reposScanned, workflowsScanned, skipped, staleAllow } };
}
// ---- IO layer (not exercised by the fixture self-test) ----
function gh(a) { return execSync(`gh ${a}`, { encoding: 'utf8', timeout: 20000 }); }
const shaCache = new Map(); // #3483: parse workflow YAML once per content SHA within a run.
function parseWorkflowFile(repo, w) {
  let raw = ''; try { raw = JSON.parse(gh(`api repos/chf3198/${repo}/contents/${w.path}`)); } catch { return null; }
  if (shaCache.has(raw.sha)) return shaCache.get(raw.sha);
  const body = Buffer.from(raw.content || '', 'base64').toString('utf8');
  const parsed = /\bschedule\s*:/.test(body) ? { cron: (body.match(/cron:\s*['"]?([^'"\n]+)/) || [])[1] || '' } : null;
  shaCache.set(raw.sha, parsed); return parsed;
}
function fetchRepoData(repo, breaker) {
  if (!cb.canPass(breaker, Date.now())) return { repo, readable: false };
  try {
    const wfs = JSON.parse(gh(`api repos/chf3198/${repo}/actions/workflows --paginate`)).workflows || [];
    const workflows = [];
    for (const w of wfs) {
      const p = parseWorkflowFile(repo, w); if (!p) continue;
      let runs = [];
      try { runs = (JSON.parse(gh(`api "repos/chf3198/${repo}/actions/workflows/${w.id}/runs?per_page=10&event=schedule"`)).workflow_runs || []).map(x => ({ conclusion: x.conclusion, created_at: x.created_at })); } catch { /* keep [] */ }
      workflows.push({ name: w.name, state: w.state, cron: p.cron, runs });
    }
    cb.recordSuccess(breaker); return { repo, archived: false, readable: true, workflows };
  } catch (e) { if (/rate limit|secondary|429/i.test(e.message)) cb.recordFailure(breaker, Date.now()); return { repo, readable: false }; }
}
function routeTriage(f) {
  const marker = `<!-- watcher-health:${f.repo}/${f.workflow} -->`;
  const body = `${marker}\nScheduled workflow **${f.workflow}** in \`chf3198/${f.repo}\` is \`${f.signature}\` (ADR-020 §D1). Auto-filed by watcher-health (#3522).`;
  try {
    const hit = JSON.parse(gh(`issue list -R chf3198/megingjord-harness --state open --label governance:needs-triage --search ${JSON.stringify(marker)} --json number`))[0];
    if (hit) gh(`issue comment ${hit.number} -R chf3198/megingjord-harness --body ${JSON.stringify(body)}`);
    else gh(`issue create -R chf3198/megingjord-harness --title ${JSON.stringify(`[WATCHER-HEALTH] ${f.repo}/${f.workflow}: ${f.signature}`)} --label governance:needs-triage --body ${JSON.stringify(body)}`);
  } catch (e) { incidents.append({ pattern_id: 'watcher-health-triage-fail', timestamp: new Date().toISOString(), ...f, error: e.message }); }
}
function main() {
  const breaker = cb.create({ threshold: 3 });
  let allow = {}; try { allow = require('./watcher-health.allow.json'); } catch { /* none */ }
  let repos;
  try { repos = JSON.parse(gh('repo list chf3198 --limit 200 --json name,isArchived')); }
  catch (e) { incidents.append({ pattern_id: 'watcher-health-enum-fail', timestamp: new Date().toISOString(), error: e.message }); process.exit(1); }
  const data = repos.map(r => r.isArchived ? { repo: r.name, archived: true } : fetchRepoData(r.name, breaker));
  const { findings, coverage } = buildReport(data, Date.now(), allow), ts = new Date().toISOString();
  for (const f of findings) { incidents.append({ pattern_id: `watcher-health:${f.repo}/${f.workflow}`, timestamp: ts, ...f }); if (f.triage) routeTriage(f); }
  incidents.append({ pattern_id: 'watcher-health-coverage', timestamp: ts, ...coverage, breaker: cb.status(breaker).state, findings: findings.length });
  console.log(`watcher-health: ${findings.length} finding(s), ${coverage.reposScanned} repos, ${coverage.workflowsScanned} scheduled workflows, breaker=${cb.status(breaker).state}`);
}
module.exports = { scheduleIntervalMs, classifyRuns, classifyWorkflow, buildReport, TRIAGE_SIGS };
if (require.main === module) main();
