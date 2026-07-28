#!/usr/bin/env node
'use strict';
// measurement-base.js (#3859, Epic #3854 GAP-C) — shared shim so governance MEASUREMENT
// (governance-surface-census, audits) resolves against origin/main rather than silently
// counting a stale local canonical checkout. Mirrors load-local-env's once-cached, fail-open,
// env-opt-out contract. READ-ONLY intent: the ONLY side effect is a fail-open
// `git fetch origin <base>` to refresh the remote-tracking ref — it never mutates a governed
// file and never throws (a measurement helper must not brick the measurer). Offline / no-git
// degrades gracefully to measuring the local tree (G6), clearly annotated (G8).
const { execSync } = require('node:child_process');

let CACHE = null;

function git(args, cwd) {
  try { return execSync(args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
  catch { return null; }
}

function resolveMeasurementBase(opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const base = opts.base || 'origin/main';
  if (process.env.MEGINGJORD_NO_MEASUREMENT_BASE_CHECK === '1') {
    return { base, behind: null, fresh: null, offline: null, skipped: 'opt-out',
      note: 'measurement-base check disabled (MEGINGJORD_NO_MEASUREMENT_BASE_CHECK=1)' };
  }
  const remote = base.includes('/') ? base.split('/')[0] : 'origin';
  const ref = base.includes('/') ? base.split('/').slice(1).join('/') : base;
  const fetched = git(`git fetch ${remote} ${ref}`, cwd) !== null; // null => offline / no remote
  const behindStr = git(`git rev-list --count HEAD..${base}`, cwd);
  const behind = behindStr != null && /^\d+$/.test(behindStr) ? Number(behindStr) : null;
  const offline = !fetched;
  const fresh = behind === 0;
  let note;
  if (behind == null) note = `measurement base unverifiable (no git / no ${base}) — measuring local tree (G6 fallback)`;
  else if (offline) note = `offline: local tree is ${behind} commit(s) behind last-known ${base} (ref not refreshed)`;
  else if (behind > 0) note = `STALE: local tree is ${behind} commit(s) behind ${base} — measurement may not reflect ${base}`;
  else note = `fresh: local tree matches ${base}`;
  return { base, behind, fresh, offline, note };
}

// Cached, stderr-warning wrapper — the entry point measurers call once per process.
function assertMeasuringOriginMain(opts = {}) {
  if (CACHE && !opts.force) return CACHE;
  CACHE = resolveMeasurementBase(opts);
  if (CACHE.behind != null && CACHE.behind > 0 && !opts.quiet) {
    process.stderr.write(`[measurement-base] ${CACHE.note}\n`);
  }
  return CACHE;
}

if (require.main === module) {
  const result = assertMeasuringOriginMain({ force: true });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(0); // advisory: measuring is never a gate (always zero-exit)
}

module.exports = { assertMeasuringOriginMain, resolveMeasurementBase, _reset: () => { CACHE = null; } };
