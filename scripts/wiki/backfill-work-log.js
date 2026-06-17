#!/usr/bin/env node
// scripts/wiki/backfill-work-log.js — one-time governed backfill of Wiki B (work-log).
// Mirrors OPEN + last-90d-closed issues -> wiki/work-log/tickets/<N>.md and merged PRs
// (last 90d) -> wiki/work-log/prs/<N>.md, each with #2052 provenance frontmatter and
// log-redaction applied to bodies. Validate-at-write aborts any entry that fails schema
// or source-hash parity. Refs #3065 (Epic #3063).
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const matter = require('gray-matter');
const { redactString } = require('../global/log-redaction');

const ROOT = path.join(__dirname, '../..');
const WORK_LOG = path.join(ROOT, 'wiki', 'work-log');
const PROVENANCE_FIELDS = ['source_path', 'source_sha256', 'content_hash', 'last_updated', 'generated_by_run'];
const MS_PER_DAY = 86400000;

function sha256Hex(text) { return crypto.createHash('sha256').update(text).digest('hex'); }

function daysAgoISO(days) {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString().split('T')[0];
}

/** Run a gh query and parse the JSON array result. Returns [] on any failure (G6). */
function ghJson(args) {
  try {
    return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) || '[]');
  } catch (err) {
    process.stderr.write(`[backfill] gh query failed (${args.join(' ')}): ${err.message}\n`);
    return [];
  }
}

function labelNames(labels) {
  return (labels || []).map((label) => (typeof label === 'string' ? label : label.name)).filter(Boolean);
}

/** Build one work-log page (frontmatter + redacted body). Returns {page, contentHash}. */
function buildPage(item, kind, runId, today) {
  const sourcePath = `github:${kind}/${item.number}`;
  const sourceSha = sha256Hex(JSON.stringify(item));
  const rawBody = redactString(item.body || '').text;
  const labels = labelNames(item.labels);
  const stateLine = kind === 'pr' ? `merged: ${item.mergedAt || item.state}` : `state: ${item.state}`;
  const bodyMd = [
    `# #${item.number} — ${item.title}`, '',
    `> **Source**: ${sourcePath} | **${stateLine}** | **Labels**: ${labels.join(', ') || 'none'}`,
    `> Mirror of \`gh ${kind === 'pr' ? 'pr' : 'issue'} view ${item.number}\` (derived; edit the GitHub item, not this page).`,
    '', '## Body', '', rawBody || '_(no body)_', '',
  ].join('\n');
  const contentHash = sha256Hex(bodyMd);
  const frontmatter = [
    '---',
    `title: "#${item.number} ${String(item.title).replace(/"/g, "'")}"`,
    'type: work-log',
    'content_trust_score: 0.6',
    `created: "${today}"`, `updated: "${today}"`,
    `tags: [${kind}, wiki-b]`, 'related: []', `status: ${item.state || 'unknown'}`,
    `source_path: "${sourcePath}"`, `source_sha256: ${sourceSha}`,
    `content_hash: ${contentHash}`, `last_updated: "${today}"`, `generated_by_run: ${runId}`,
    '---', '',
  ].join('\n');
  return { page: frontmatter + bodyMd, sourceSha };
}

/** Validate-at-write (AC3): frontmatter schema fields + source-hash parity. Throws to abort entry. */
function assertEntryValid(item, page, sourceSha) {
  const { data } = matter(page);
  for (const field of ['title', 'type', 'content_trust_score', 'created', 'updated', ...PROVENANCE_FIELDS]) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new Error(`#${item.number}: frontmatter missing '${field}'`);
    }
  }
  if (data.source_sha256 !== sourceSha) throw new Error(`#${item.number}: source_sha256 parity mismatch`);
  if (sha256Hex(JSON.stringify(item)) !== sourceSha) throw new Error(`#${item.number}: source drifted at write`);
  // content_hash must equal sha256 of the rendered body (the post-frontmatter content).
  const { content: body } = matter(page);
  if (data.content_hash !== sha256Hex(body)) throw new Error(`#${item.number}: content_hash parity mismatch`);
}

function writeItems(items, kind, outDir, opts, runId, today) {
  fs.mkdirSync(outDir, { recursive: true });
  const written = []; const skipped = [];
  for (const item of items) {
    try {
      // Filename is derived from item.number; require a positive integer so a
      // malformed source can never produce a path-traversal write (defense in depth).
      if (!Number.isInteger(item.number) || item.number <= 0) {
        throw new Error(`invalid item.number ${JSON.stringify(item.number)}`);
      }
      const { page, sourceSha } = buildPage(item, kind, runId, today);
      assertEntryValid(item, page, sourceSha);
      if (!opts.dryRun) fs.writeFileSync(path.join(outDir, `${item.number}.md`), page);
      written.push(item.number);
    } catch (err) {
      process.stderr.write(`[backfill] skip ${kind} #${item.number}: ${err.message}\n`);
      skipped.push(item.number);
    }
  }
  return { written, skipped };
}

/** Collect source issues + PRs from gh (or opts.items override for deterministic tests). */
function collectSources(opts) {
  if (opts.items) {
    const open = opts.items.open || opts.items.tickets || [];
    return { open, closed: opts.items.closed || [], mergedPrs: opts.items.prs || [] };
  }
  const since = daysAgoISO(opts.sinceDays || 90);
  const limit = String(opts.limit || 1000);
  const fields = 'number,title,state,body,labels,updatedAt';
  return {
    open: ghJson(['issue', 'list', '--state', 'open', '--json', fields, '--limit', limit]),
    closed: ghJson(['issue', 'list', '--state', 'closed', '--search', `closed:>=${since}`, '--json', fields, '--limit', limit]),
    mergedPrs: ghJson(['pr', 'list', '--state', 'merged', '--search', `merged:>=${since}`, '--json', 'number,title,state,body,labels,mergedAt', '--limit', limit]),
  };
}

/**
 * Backfill Wiki B from current GitHub sources.
 * @param {{dryRun?:boolean, workLogDir?:string, sinceDays?:number, limit?:number, items?:object}} [opts]
 * @returns {{tickets:object, prs:object, sourceCounts:object}}
 */
function backfillWorkLog(opts = {}) {
  const base = opts.workLogDir || WORK_LOG;
  const runId = opts.runId || process.env.GITHUB_RUN_ID || 'local';
  const today = new Date().toISOString().split('T')[0];
  const { open: openIssues, closed: closedIssues, mergedPrs } = collectSources(opts);
  const issues = [...openIssues, ...closedIssues];
  const tickets = writeItems(issues, 'issue', path.join(base, 'tickets'), opts, runId, today);
  const prs = writeItems(mergedPrs, 'pr', path.join(base, 'prs'), opts, runId, today);
  return {
    tickets, prs,
    sourceCounts: { open: openIssues.length, closed: closedIssues.length, mergedPrs: mergedPrs.length },
  };
}

module.exports = { backfillWorkLog, buildPage, assertEntryValid, sha256Hex, PROVENANCE_FIELDS };

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  const result = backfillWorkLog({ dryRun });
  console.log(`Wiki B backfill: ${result.tickets.written.length} tickets, ${result.prs.written.length} PRs ` +
    `(skipped ${result.tickets.skipped.length + result.prs.skipped.length}); ` +
    `sources open=${result.sourceCounts.open} closed=${result.sourceCounts.closed} prs=${result.sourceCounts.mergedPrs}`);
}
