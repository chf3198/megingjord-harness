#!/usr/bin/env node
// scripts/wiki/auto-update-pipeline.js — Thin orchestrator for 11-stage pipeline.
// Triggered by wiki-auto-update.yml on pull_request closed+merged.
// Also available on-demand: npm run wiki:auto-update
// CommonJS. Refs #2055
'use strict';

const {
  classifyDiff, scanInvisibleChars, generateFrontmatter, INVISIBLE_CHAR_PATTERNS,
} = require('./pipeline-classify');
const {
  stage1Classify, stage2InvisibleCharScan, stage3ExtractCode,
  stage4ExtractWorkLog, stage5ExtractWisdom, stage6GenerateFrontmatter,
} = require('./pipeline-stages-a');
const {
  stage7Sign, stage8Validate, stage9Write, stage10Commit, stage11Summary,
} = require('./pipeline-stages-b');

const STAGE_FNS = [
  stage1Classify, stage2InvisibleCharScan, stage3ExtractCode,
  stage4ExtractWorkLog, stage5ExtractWisdom, stage6GenerateFrontmatter,
  stage7Sign, stage8Validate, stage9Write, stage10Commit, stage11Summary,
];

/**
 * Run the full 11-stage wiki auto-update pipeline.
 * @param {object} opts
 * @param {string[]} opts.changedFiles   - file paths changed in the PR
 * @param {string[]} [opts.fileContents] - raw content strings for invisible-char scan
 * @param {number|string} opts.prNumber  - originating PR number
 * @param {string} [opts.date]           - ISO date override (defaults to today)
 * @param {boolean} [opts.sign]          - Ed25519-sign pages
 * @param {boolean} [opts.writeEnabled]  - write files to disk
 * @param {string} [opts.repoRoot]       - repo root for file writes
 * @param {object} [opts.fs]             - fs module override for testing
 * @returns {object} pipeline context
 */
function runPipeline(opts = {}) {
  const ctx = {
    changedFiles: opts.changedFiles || [],
    fileContents: opts.fileContents || [],
    prNumber: opts.prNumber || 0,
    date: opts.date || new Date().toISOString().split('T')[0],
    sign: opts.sign || false,
    writeEnabled: opts.writeEnabled || false,
    repoRoot: opts.repoRoot || process.cwd(),
    fs: opts.fs || require('fs'),
    log: [],
    classified: null,
    invisibleScan: null,
    codeDeltas: [],
    workLogEntries: [],
    wisdomEntries: [],
    generatedPages: [],
    validationErrors: [],
    writtenPaths: [],
    commitPlan: null,
    summary: '',
  };
  for (const stageFn of STAGE_FNS) stageFn(ctx);
  return ctx;
}

module.exports = {
  runPipeline, classifyDiff, scanInvisibleChars, generateFrontmatter, INVISIBLE_CHAR_PATTERNS,
};

if (require.main === module) {
  const changedFiles = (process.env.CHANGED_FILES || '').split(',').filter(Boolean);
  const prNumber = process.env.PR_NUMBER || '0';
  try {
    const ctx = runPipeline({ changedFiles, prNumber });
    console.log(ctx.summary);
    process.exit(0);
  } catch (err) {
    console.error(`Pipeline error: ${err.message}`);
    process.exit(1);
  }
}
