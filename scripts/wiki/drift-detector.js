// scripts/wiki/drift-detector.js — Bi-directional drift gate (advisory Phase-1) Refs #2058
// Compares source files ↔ Wiki A symbols ↔ Wiki B work-log ↔ Wiki C wisdom.
// Emits JSON: orphan wiki entries, uncovered sources, stale entries, severity.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const WIKI = path.join(ROOT, 'wiki');
const SRC_DIRS = [{ d: path.join(ROOT, 'scripts/global'), r: /\.js$/ }, { d: path.join(ROOT, 'instructions'), r: /\.md$/ }];
const SYM_DIR = path.join(WIKI, 'code', 'symbols');
const WL_DIRS = [path.join(WIKI, 'work-log', 'tickets'), path.join(WIKI, 'work-log', 'prs')];
const WISDOM_DIR = path.join(WIKI, 'wisdom');

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function lsFiles(dir, re) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => re.test(f)).map(f => path.join(dir, f));
}

function lsMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? lsMd(p) : e.name.endsWith('.md') ? [p] : [];
  });
}

function fm(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  return Object.fromEntries(m[1].split('\n').flatMap(l => {
    const [k, ...v] = l.split(':');
    return k && v.length ? [[k.trim(), v.join(':').trim().replace(/^["']|["']$/g, '')]] : [];
  }));
}

function detectCodeDrift() {
  const orphans = [], uncovered = [], stale = [], covered = new Set();
  for (const sf of lsFiles(SYM_DIR, /\.md$/)) {
    const f = fm(fs.readFileSync(sf, 'utf-8'));
    const src = f.source_path ? path.join(ROOT, f.source_path) : null;
    if (!src || !fs.existsSync(src)) {
      orphans.push({ wiki: path.relative(ROOT, sf), reason: 'no-source-backing' });
    } else {
      covered.add(src);
      if (f.source_sha256 && sha256(fs.readFileSync(src, 'utf-8')) !== f.source_sha256)
        stale.push({ wiki: path.relative(ROOT, sf), source: f.source_path, reason: 'hash-mismatch' });
    }
  }
  for (const { d, r } of SRC_DIRS)
    for (const f of lsFiles(d, r))
      if (!covered.has(f)) uncovered.push({ source: path.relative(ROOT, f), reason: 'no-wiki-coverage' });
  return { orphans, uncovered, stale };
}

function detectWorkLogDrift() {
  return WL_DIRS.flatMap(dir => lsFiles(dir, /\.md$/).flatMap(f => {
    const m = fm(fs.readFileSync(f, 'utf-8'));
    return (!m.source_issue && !m.source_pr)
      ? [{ wiki: path.relative(ROOT, f), reason: 'no-source-backing' }] : [];
  }));
}

function detectWisdomDrift() {
  return lsMd(WISDOM_DIR).flatMap(f => {
    const m = fm(fs.readFileSync(f, 'utf-8'));
    return (!m.source_ref && !m.sources) ? [{ wiki: path.relative(ROOT, f), reason: 'no-source-ref' }] : [];
  });
}

function severity(n) { return n === 0 ? 'ok' : n < 5 ? 'advisory' : 'warn'; }

function run() {
  const code = detectCodeDrift();
  const wl = detectWorkLogDrift();
  const wi = detectWisdomDrift();
  const totalOrphans = code.orphans.length + wl.length + wi.length;
  const report = {
    generated: new Date().toISOString(),
    summary: {
      orphan_wiki_entries: totalOrphans,
      uncovered_sources: code.uncovered.length,
      stale_entries: code.stale.length,
      severity: severity(totalOrphans + code.stale.length),
    },
    code_wiki: { orphans: code.orphans, uncovered: code.uncovered, stale: code.stale },
    work_log: { orphans: wl },
    wisdom: { orphans: wi },
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) run();
module.exports = { run, detectCodeDrift, detectWorkLogDrift, detectWisdomDrift, sha256, parseFm: fm };
