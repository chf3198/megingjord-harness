// scripts/wiki/drift-detector.js — Bi-directional drift gate (advisory Phase-1) Refs #2058
// Compares source files ↔ Wiki A symbols ↔ Wiki B work-log ↔ Wiki C wisdom.
// Emits JSON: orphan wiki entries, uncovered sources, stale entries, severity.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const WIKI = path.join(ROOT, 'wiki');
const SRC_DIRS = [{ dir: path.join(ROOT, 'scripts/global'), re: /\.js$/ }, { dir: path.join(ROOT, 'instructions'), re: /\.md$/ }];
const SYM_DIR = path.join(WIKI, 'code', 'symbols');
const WL_DIRS = [path.join(WIKI, 'work-log', 'tickets'), path.join(WIKI, 'work-log', 'prs')];
const WISDOM_DIR = path.join(WIKI, 'wisdom');

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function lsFiles(dir, re) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => re.test(name)).map(name => path.join(dir, name));
}

function lsMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? lsMd(full) : entry.name.endsWith('.md') ? [full] : [];
  });
}

function parseFm(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  return Object.fromEntries(match[1].split('\n').flatMap(line => {
    const [key, ...vals] = line.split(':');
    return key && vals.length ? [[key.trim(), vals.join(':').trim().replace(/^["']|["']$/g, '')]] : [];
  }));
}

function detectCodeDrift() {
  const orphans = [], uncovered = [], stale = [], covered = new Set();
  for (const sf of lsFiles(SYM_DIR, /\.md$/)) {
    const meta = parseFm(fs.readFileSync(sf, 'utf-8'));
    const src = meta.source_path ? path.join(ROOT, meta.source_path) : null;
    if (!src || !fs.existsSync(src)) {
      orphans.push({ wiki: path.relative(ROOT, sf), reason: 'no-source-backing' });
    } else {
      covered.add(src);
      if (meta.source_sha256 && sha256(fs.readFileSync(src, 'utf-8')) !== meta.source_sha256)
        stale.push({ wiki: path.relative(ROOT, sf), source: meta.source_path, reason: 'hash-mismatch' });
    }
  }
  for (const { dir, re } of SRC_DIRS)
    for (const srcFile of lsFiles(dir, re))
      if (!covered.has(srcFile)) uncovered.push({ source: path.relative(ROOT, srcFile), reason: 'no-wiki-coverage' });
  return { orphans, uncovered, stale };
}

function detectWorkLogDrift() {
  return WL_DIRS.flatMap(dir => lsFiles(dir, /\.md$/).flatMap(wikiFile => {
    const meta = parseFm(fs.readFileSync(wikiFile, 'utf-8'));
    return (!meta.source_issue && !meta.source_pr) ? [{ wiki: path.relative(ROOT, wikiFile), reason: 'no-source-backing' }] : [];
  }));
}

function detectWisdomDrift() {
  return lsMd(WISDOM_DIR).flatMap(wikiFile => {
    const meta = parseFm(fs.readFileSync(wikiFile, 'utf-8'));
    return (!meta.source_ref && !meta.sources) ? [{ wiki: path.relative(ROOT, wikiFile), reason: 'no-source-ref' }] : [];
  });
}

function severity(n) { return n === 0 ? 'ok' : n < 5 ? 'advisory' : 'warn'; }

function run() {
  const code = detectCodeDrift();
  const wlOrphans = detectWorkLogDrift();
  const wiOrphans = detectWisdomDrift();
  const totalOrphans = code.orphans.length + wlOrphans.length + wiOrphans.length;
  const report = {
    generated: new Date().toISOString(),
    summary: {
      orphan_wiki_entries: totalOrphans, uncovered_sources: code.uncovered.length,
      stale_entries: code.stale.length, severity: severity(totalOrphans + code.stale.length),
    },
    code_wiki: { orphans: code.orphans, uncovered: code.uncovered, stale: code.stale },
    work_log: { orphans: wlOrphans },
    wisdom: { orphans: wiOrphans },
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) run();
module.exports = { run, detectCodeDrift, detectWorkLogDrift, detectWisdomDrift, sha256, parseFm };
