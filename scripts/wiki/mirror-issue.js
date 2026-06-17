#!/usr/bin/env node
// scripts/wiki/mirror-issue.js — live single-issue mirror for Wiki B (work-log).
// Renders ONE GitHub issue into wiki/work-log/tickets/<N>.md, reusing the #3065
// backfill renderer (buildPage + assertEntryValid: provenance frontmatter +
// log-redaction + validate-at-write). Idempotent: source_sha256 is the idempotency
// key — a re-run on unchanged source is a no-op (no diff). Refs #3066 (Epic #3063).
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const matter = require('gray-matter');
const { buildPage, assertEntryValid } = require('./backfill-work-log');

const ROOT = path.join(__dirname, '../..');
const TICKETS_DIR = path.join(ROOT, 'wiki', 'work-log', 'tickets');
const ISSUE_FIELDS = 'number,title,state,body,labels,updatedAt';

/** Fetch a single issue's JSON via gh. Throws on failure (the workflow surfaces it). */
function fetchIssue(number) {
  const out = execFileSync('gh', ['issue', 'view', String(number), '--json', ISSUE_FIELDS],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(out);
}

/**
 * Mirror one issue into wiki/work-log/tickets/<N>.md.
 * @param {number|string} number issue number
 * @param {{item?:object, ticketsDir?:string, dryRun?:boolean, runId?:string, today?:string}} [opts]
 * @returns {{number:number, changed:boolean, outPath:string, reason?:string}}
 */
function mirrorIssue(number, opts = {}) {
  const num = Number(number);
  if (!Number.isInteger(num) || num <= 0) throw new Error(`invalid issue number ${JSON.stringify(number)}`);
  const dir = opts.ticketsDir || TICKETS_DIR;
  const runId = opts.runId || process.env.GITHUB_RUN_ID || 'local';
  const today = opts.today || new Date().toISOString().split('T')[0];
  const item = opts.item || fetchIssue(num);
  const { page, sourceSha } = buildPage(item, 'issue', runId, today);
  assertEntryValid(item, page, sourceSha); // validate-at-write (AC3, from the backfill renderer)
  const outPath = path.join(dir, `${num}.md`);
  // Idempotency (AC2): skip the write when the existing page already mirrors this
  // exact source (source_sha256 match), so a re-run produces no diff.
  if (fs.existsSync(outPath)) {
    const existing = matter(fs.readFileSync(outPath, 'utf8')).data;
    if (existing.source_sha256 === sourceSha) return { number: num, changed: false, outPath, reason: 'unchanged' };
  }
  if (!opts.dryRun) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, page);
  }
  return { number: num, changed: true, outPath };
}

module.exports = { mirrorIssue, fetchIssue, TICKETS_DIR };

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const number = args.find((a) => /^\d+$/.test(a));
  if (!number) { console.error('Usage: mirror-issue.js <issue-number> [--dry-run]'); process.exit(2); }
  const result = mirrorIssue(number, { dryRun });
  console.log(`mirror-issue #${result.number}: ${result.changed ? 'updated' : 'unchanged'} (${result.outPath})`);
}
