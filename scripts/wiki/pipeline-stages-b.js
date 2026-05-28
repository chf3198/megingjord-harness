// scripts/wiki/pipeline-stages-b.js — Stages 7-11 of wiki auto-update pipeline.
// CommonJS. Refs #2055
'use strict';

const path = require('path');
const crypto = require('crypto');
const matter = require('gray-matter');
const { validateContent } = require('./validate-frontmatter');
const { buildAttestation } = require('./sign-frontmatter');

const WIKI_TYPE_DIR = {
  code: 'wiki/code', 'work-log': 'wiki/work-log', 'wisdom-project': 'wiki/wisdom/project',
};

/**
 * Stage 7: Optionally Ed25519-sign trust_attestation (#2052).
 * @param {object} ctx pipeline context
 */
function stage7Sign(ctx) {
  if (!ctx.sign) { ctx.log.push({ stage: 7, name: 'sign', skipped: true }); return; }
  const kp = crypto.generateKeyPairSync('ed25519');
  const rawPub = kp.publicKey.export({ format: 'der', type: 'spki' }).slice(12).toString('hex');
  for (const page of ctx.generatedPages) {
    page.fm.trust_attestation = buildAttestation(page.body, kp.privateKey, rawPub);
  }
  ctx.log.push({ stage: 7, name: 'sign', pages: ctx.generatedPages.length });
}

/**
 * Stage 8: Validate generated entries against frontmatter schema (#2052).
 * @param {object} ctx pipeline context
 */
function stage8Validate(ctx) {
  const errors = [];
  for (const page of ctx.generatedPages) {
    const result = validateContent(matter.stringify(page.body, page.fm), { verifySignature: false });
    if (!result.valid) errors.push({ slug: page.slug, errors: result.errors });
  }
  ctx.validationErrors = errors;
  ctx.log.push({ stage: 8, name: 'validate-frontmatter', errors: errors.length });
  if (errors.length > 0) {
    throw new Error(
      `Stage 8: frontmatter validation failed for: ${errors.map((e) => e.slug).join(', ')}`
    );
  }
}

/**
 * Stage 9: Write pages to wiki paths (dry-run unless writeEnabled).
 * @param {object} ctx pipeline context
 */
function stage9Write(ctx) {
  ctx.writtenPaths = [];
  for (const page of ctx.generatedPages) {
    const dir = WIKI_TYPE_DIR[page.wikiType] || 'wiki/wisdom/project';
    const filePath = `${dir}/${page.slug}.md`;
    const content = matter.stringify(page.body, page.fm);
    if (ctx.writeEnabled && ctx.fs) {
      ctx.fs.mkdirSync(path.join(ctx.repoRoot || '.', dir), { recursive: true });
      ctx.fs.writeFileSync(path.join(ctx.repoRoot || '.', filePath), content);
    }
    ctx.writtenPaths.push({ filePath, content });
  }
  ctx.log.push({ stage: 9, name: 'write-pages', paths: ctx.writtenPaths.map((p) => p.filePath) });
}

/**
 * Stage 10: Record commit plan (dry-run; no git commands executed).
 * @param {object} ctx pipeline context
 */
function stage10Commit(ctx) {
  const branch = `wiki-auto-update/pr-${ctx.prNumber}`;
  ctx.commitPlan = {
    branch,
    message: `chore(wiki): auto-update from PR #${ctx.prNumber} #2055`,
    files: ctx.writtenPaths.map((p) => p.filePath),
    prTitle: `chore(wiki): auto-update from PR #${ctx.prNumber}`,
    executed: false,
  };
  ctx.log.push({ stage: 10, name: 'commit-plan', branch, files: ctx.commitPlan.files.length });
}

/**
 * Stage 11: Build auto-update summary string for PR comment.
 * @param {object} ctx pipeline context
 */
function stage11Summary(ctx) {
  const wb = ctx.writtenPaths.length > 0
    ? `**Written paths:**\n${ctx.writtenPaths.map((p) => `- \`${p.filePath}\``).join('\n')}`
    : '_No pages written (dry-run or no changes classified)._';
  const counts = `- Code deltas: ${ctx.codeDeltas.length}\n- Work-log entries: ${ctx.workLogEntries.length}\n`
    + `- Wisdom entries: ${ctx.wisdomEntries.length}\n- Pages generated: ${ctx.generatedPages.length}\n`
    + `- Validation errors: ${ctx.validationErrors.length}`;
  ctx.summary = `## Wiki Auto-Update Summary\n\nPR #${ctx.prNumber} triggered wiki auto-update pipeline (Refs #2055).\n\n${counts}\n\n${wb}`;
  ctx.log.push({ stage: 11, name: 'summary', length: ctx.summary.length });
}

module.exports = { stage7Sign, stage8Validate, stage9Write, stage10Commit, stage11Summary };
