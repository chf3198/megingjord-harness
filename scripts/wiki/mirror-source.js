'use strict';
// #3779 (Epic #3719): consumer read-path cutover. The reconcile (#3729) lands fresh work-log mirrors on the
// non-protected `wiki-mirror` branch (main's ruleset rejects direct pushes), but retrieval reads the frozen
// `wiki/work-log/` on main. This materializes `wiki-mirror:wiki/work-log/` into a gitignored cache so the
// RETRIEVAL read path can consume fresh mirrors — with a graceful Tier-0 fallback to local (never throws:
// air-gapped clones / missing branch fall back to the stale-but-functional local mirrors, no hard failure).
// Scope: read path ONLY. The reconcile/health write path keeps reading local wiki/ (no circular dependency).
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');
const CACHE_DIR = path.join(REPO_ROOT, '.wiki-mirror-cache');
const DEFAULT_REF = 'origin/wiki-mirror';
const WORK_LOG_DIRS = [{ dir: 'work-log/tickets', type: 'ticket' }, { dir: 'work-log/prs', type: 'pr' }];

/**
 * Materialize wiki-mirror's wiki/work-log/ into the gitignored cache. Never throws.
 * @param {{exec?: function, root?: string, cacheDir?: string, ref?: string}} [opts] - injectable for tests
 * @returns {string|null} absolute path to the materialized `wiki/` in the cache, or null if unavailable
 */
function ensureMirrorCache(opts = {}) {
  const root = opts.root || REPO_ROOT;
  const cacheDir = opts.cacheDir || CACHE_DIR;
  const ref = opts.ref || process.env.WIKI_MIRROR_REF || DEFAULT_REF;
  const exec = opts.exec || ((cmd) => execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }));
  try {
    // Refresh the ref (best-effort) then extract only wiki/work-log/ via git archive (no working-tree touch).
    try { exec(`git fetch --quiet origin wiki-mirror:refs/remotes/origin/wiki-mirror`); } catch { /* offline: use whatever ref exists */ }
    fs.rmSync(cacheDir, { recursive: true, force: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    exec(`git archive ${ref} wiki/work-log | tar -x -C ${JSON.stringify(cacheDir)}`);
    const wikiPath = path.join(cacheDir, 'wiki');
    return fs.existsSync(path.join(wikiPath, 'work-log')) ? wikiPath : null;
  } catch { return null; } // graceful: caller falls back to local
}

/**
 * Fresh work-log page objects from the wiki-mirror cache, or null when the mirror is unavailable.
 * @param {object} [opts] - forwarded to ensureMirrorCache
 * @returns {Array<{slug: string, type: string, path: string}>|null}
 */
function listMirrorWorkLogPages(opts = {}) {
  const wikiPath = opts.wikiPath || ensureMirrorCache(opts);
  if (!wikiPath) return null;
  const pages = [];
  for (const { dir, type } of WORK_LOG_DIRS) {
    const dp = path.join(wikiPath, dir);
    if (!fs.existsSync(dp)) continue;
    for (const file of fs.readdirSync(dp).filter((x) => x.endsWith('.md'))) {
      pages.push({ slug: file.replace('.md', ''), type, path: path.join(dp, file) });
    }
  }
  return pages.length ? pages : null;
}

module.exports = { ensureMirrorCache, listMirrorWorkLogPages, CACHE_DIR, DEFAULT_REF, WORK_LOG_DIRS };
