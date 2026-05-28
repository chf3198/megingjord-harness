#!/usr/bin/env node
// scripts/wiki/ingest-code.js — Wiki A code-ingest -> wiki/code/. Refs #2053
'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { scanContent } = require('./invisible-char-scan');

const ROOT = path.join(__dirname, '../..');
const WIKI_CODE = path.join(ROOT, 'wiki', 'code');
const GLOBS = [
  { dir: path.join(ROOT, 'scripts', 'global'), ext: '.js', type: 'script' },
  { dir: path.join(ROOT, 'instructions'), ext: '.md', type: 'instruction' },
];

function computeTrustScore({ hasTests, crossRefs, invisible }) {
  let score = 0.5;
  if (hasTests) score += 0.2;
  if (crossRefs >= 3) score += 0.15;
  else if (crossRefs >= 1) score += 0.07;
  if (invisible.some((flag) => flag.severity === 'HIGH')) score -= 0.4;
  else if (invisible.some((f) => f.severity === 'MEDIUM')) s -= 0.1;
  return Math.max(0, Math.min(1, Math.round(s * 100) / 100));
}

function toSlug(p) { return path.basename(p, path.extname(p)); }

function countCrossRefs(c) { return (c.match(/\[\[[\w-]+\]\]|Refs\s+#\d+/g) || []).length; }

function hasTestCoverage(slug) {
  const testsDir = path.join(ROOT, 'tests');
  return fs.existsSync(testsDir) && fs.readdirSync(testsDir).some((tf) => tf.includes(slug) && tf.endsWith('.spec.js'));
}

function buildCodePage({ slug, title, type, srcPath, trustScore, invisible, today }) {
  const rel = path.relative(ROOT, srcPath);
  const inv = invisible.length
    ? invisible.map((f) => `  - ${f.codepoint} ${f.name} at ${f.path}:${f.line}:${f.col}`).join('\n')
    : '  none';
  return [
    '---',
    `title: "${title}"`, `type: code`, `content_trust_score: ${trustScore}`,
    `created: "${today}"`, `updated: "${today}"`,
    `tags: [${type}, wiki-a]`, `related: []`, `status: generated`, `source_file: "${rel}"`,
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
function ingestCode(opts = {}) {
  const outDir = opts.wikiCodeDir || WIKI_CODE;
  fs.mkdirSync(outDir, { recursive: true });
  const today = new Date().toISOString().split('T')[0];
  const results = [];
  for (const { dir, ext, type } of GLOBS) {
    if (!fs.existsSync(dir)) continue;
    for (const fname of fs.readdirSync(dir).filter((n) => n.endsWith(ext))) {
      const srcPath = path.join(dir, fname);
      const content = fs.readFileSync(srcPath, 'utf-8');
      const slug = toSlug(srcPath);
      const invisible = scanContent(srcPath, content);
      const trustScore = computeTrustScore({
        hasTests: hasTestCoverage(slug), crossRefs: countCrossRefs(content), invisible,
      });
      const title = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const page = buildCodePage({ slug, title, type, srcPath, trustScore, invisible, today });
      const outPath = path.join(outDir, `${slug}.md`);
      if (!opts.dryRun) {
        fs.writeFileSync(outPath, page);
        if (matter(page).data.content_trust_score == null) {
          throw new Error(`content_trust_score missing in ${outPath}`);
        }
      }
      results.push({ slug, outPath, trustScore, invisible, status: 'ok' });
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
