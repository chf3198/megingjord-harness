// scripts/wiki/pipeline-stages-a.js — Stages 1-6 of wiki auto-update pipeline.
// CommonJS. Refs #2055
'use strict';

const path = require('path');
const { classifyDiff, scanInvisibleChars, generateFrontmatter } = require('./pipeline-classify');

/**
 * Stage 1: Classify changed files into wiki target categories.
 * @param {object} ctx pipeline context
 */
function stage1Classify(ctx) {
  ctx.classified = classifyDiff(ctx.changedFiles || []);
  ctx.log.push({ stage: 1, name: 'classify-diff', result: ctx.classified });
}

/**
 * Stage 2: Scan file contents for invisible chars. Aborts on HIGH severity.
 * @param {object} ctx pipeline context
 */
function stage2InvisibleCharScan(ctx) {
  const scan = scanInvisibleChars((ctx.fileContents || []).join('\n'));
  ctx.invisibleScan = scan;
  ctx.log.push({ stage: 2, name: 'invisible-char-scan', scan });
  if (scan.maxSeverity === 'HIGH') {
    const names = scan.findings.filter((f) => f.severity === 'HIGH').map((f) => f.name);
    throw new Error(`Stage 2 abort: HIGH-severity invisible chars detected: ${names.join(', ')}`);
  }
}

/**
 * Stage 3: Extract code-ingest deltas (Wiki A).
 * @param {object} ctx pipeline context
 */
function stage3ExtractCode(ctx) {
  ctx.codeDeltas = ctx.classified.code.map((f) => ({
    file: f,
    slug: path.basename(f, path.extname(f)).replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
  }));
  ctx.log.push({ stage: 3, name: 'extract-code-deltas', count: ctx.codeDeltas.length });
}

/**
 * Stage 4: Extract work-log entries (Wiki B).
 * @param {object} ctx pipeline context
 */
function stage4ExtractWorkLog(ctx) {
  ctx.workLogEntries = ctx.classified.workLog.map((f) => ({
    file: f,
    slug: `pr-${ctx.prNumber}-${path.basename(f, path.extname(f))}`.toLowerCase(),
  }));
  ctx.log.push({ stage: 4, name: 'extract-work-log', count: ctx.workLogEntries.length });
}

/**
 * Stage 5: Extract wisdom entries (Wiki C scope=project).
 * @param {object} ctx pipeline context
 */
function stage5ExtractWisdom(ctx) {
  ctx.wisdomEntries = ctx.classified.wisdom.map((f) => ({
    file: f,
    slug: path.basename(f, path.extname(f)).replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
  }));
  ctx.log.push({ stage: 5, name: 'extract-wisdom', count: ctx.wisdomEntries.length });
}

/**
 * Stage 6: Generate frontmatter per #2052 schema (with content_trust_score).
 * @param {object} ctx pipeline context
 */
function stage6GenerateFrontmatter(ctx) {
  const today = ctx.date || new Date().toISOString().split('T')[0];
  ctx.generatedPages = [];
  const push = (slug, wikiType, prN) => {
    const fm = generateFrontmatter({ title: slug, type: wikiType, prNumber: prN, date: today });
    const body = `# ${fm.title}\n\nAuto-generated from PR #${prN}.\n`;
    ctx.generatedPages.push({ slug, wikiType, fm, body });
  };
  for (const d of ctx.codeDeltas) push(d.slug, 'code', ctx.prNumber);
  for (const e of ctx.workLogEntries) push(e.slug, 'work-log', ctx.prNumber);
  for (const e of ctx.wisdomEntries) push(e.slug, 'wisdom-project', ctx.prNumber);
  ctx.log.push({ stage: 6, name: 'generate-frontmatter', pages: ctx.generatedPages.length });
}

module.exports = {
  stage1Classify, stage2InvisibleCharScan, stage3ExtractCode,
  stage4ExtractWorkLog, stage5ExtractWisdom, stage6GenerateFrontmatter,
};
