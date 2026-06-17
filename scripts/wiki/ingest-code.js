#!/usr/bin/env node
// scripts/wiki/ingest-code.js — Wiki A code-ingest -> wiki/code/. Refs #2053
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const { scanContent } = require('./invisible-char-scan');

const ROOT = path.join(__dirname, '../..');
const WIKI_CODE = path.join(ROOT, 'wiki', 'code');
// sub_layer routing per the Three-Wiki storage layout (wiki-knowledge.instructions.md):
// scripts -> wiki/code/symbols/ (structural), instructions -> wiki/code/concepts/ (semantic).
const GLOBS = [
  { dir: path.join(ROOT, 'scripts', 'global'), ext: '.js', type: 'script', subdir: 'symbols' },
  { dir: path.join(ROOT, 'instructions'), ext: '.md', type: 'instruction', subdir: 'concepts' },
];

function computeTrustScore({ hasTests, crossRefs, invisible = [] }) {
  let score = 0.5;
  if (hasTests) score += 0.2;
  if (crossRefs >= 3) score += 0.15;
  else if (crossRefs >= 1) score += 0.07;
  if (invisible.some((flag) => flag.severity === 'HIGH')) score -= 0.4;
  else if (invisible.some((f) => f.severity === 'MEDIUM')) score -= 0.1;
  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

function sha256Hex(text) { return crypto.createHash('sha256').update(text).digest('hex'); }

function toSlug(p) { return path.basename(p, path.extname(p)); }

function countCrossRefs(c) { return (c.match(/\[\[[\w-]+\]\]|Refs\s+#\d+/g) || []).length; }

function hasTestCoverage(slug) {
  const testsDir = path.join(ROOT, 'tests');
  return fs.existsSync(testsDir) && fs.readdirSync(testsDir).some((tf) => tf.includes(slug) && tf.endsWith('.spec.js'));
}

function buildCodePage({ slug, title, type, srcPath, content, trustScore, invisible, today, runId }) {
  const rel = path.relative(ROOT, srcPath);
  const inv = invisible.length
    ? invisible.map((f) => `  - ${f.codepoint} ${f.name} at ${f.path}:${f.line}:${f.col}`).join('\n')
    : '  none';
  const subLayer = type === 'script' ? 'structural' : 'semantic';
  return [
    '---',
    `title: "${title}"`, `type: code`, `sub_layer: ${subLayer}`,
    `content_trust_score: ${trustScore}`,
    `created: "${today}"`, `updated: "${today}"`,
    `tags: [${type}, wiki-a]`, `related: []`, `status: generated`,
    `source_file: "${rel}"`, `source_path: "${rel}"`, `source_sha256: ${sha256Hex(content)}`,
    `last_updated: "${today}"`, `generated_by_run: ${runId}`,
    '---', '',
    `# ${title}`, '',
    `> **Source**: \`${rel}\` | **Type**: ${type} | **Trust**: ${trustScore}`, '',
    `## Invisible Character Scan\n\n${inv}\n`,
  ].join('\n');
}

/**
 * Ingest source files into wiki/code/.
 * @param {{wikiCodeDir?:string, dryRun?:boolean}} [opts]
 * @returns {Array<{slug,outPath,trustScore,invisible,status}>}
 */
function ingestOne({ srcPath, type, subdir, subDir, today, runId, dryRun }) {
  const content = fs.readFileSync(srcPath, 'utf-8');
  const slug = toSlug(srcPath);
  const invisible = scanContent(srcPath, content);
  const trustScore = computeTrustScore({
    hasTests: hasTestCoverage(slug), crossRefs: countCrossRefs(content), invisible,
  });
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  const page = buildCodePage({ slug, title, type, srcPath, content, trustScore, invisible, today, runId });
  // Validate-at-write (AC3): frontmatter must parse with content_trust_score present.
  if (matter(page).data.content_trust_score == null) {
    throw new Error(`content_trust_score missing for ${slug}; aborting entry`);
  }
  const outPath = path.join(subDir, `${slug}.md`);
  if (!dryRun) fs.writeFileSync(outPath, page);
  return { slug, outPath, subdir, trustScore, invisible, status: 'ok' };
}

function ingestCode(opts = {}) {
  const outDir = opts.wikiCodeDir || WIKI_CODE;
  const runId = opts.runId || process.env.GITHUB_RUN_ID || 'local';
  const today = new Date().toISOString().split('T')[0];
  const results = [];
  for (const { dir, ext, type, subdir } of GLOBS) {
    if (!fs.existsSync(dir)) continue;
    const subDir = path.join(outDir, subdir);
    fs.mkdirSync(subDir, { recursive: true });
    for (const fname of fs.readdirSync(dir).filter((n) => n.endsWith(ext))) {
      const srcPath = path.join(dir, fname);
      results.push(ingestOne({ srcPath, type, subdir, subDir, today, runId, dryRun: opts.dryRun }));
    }
  }
  return results;
}

module.exports = { ingestCode, computeTrustScore, buildCodePage, toSlug, countCrossRefs };

if (require.main === module) {
  const res = ingestCode();
  const flagged = res.filter((r) => r.invisible.length);
  console.log(`Ingested ${res.length} entities into wiki/code/`);
  if (flagged.length) console.warn(`WARNING: ${flagged.length} file(s) contain invisible chars`);
}
