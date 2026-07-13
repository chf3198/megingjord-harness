#!/usr/bin/env node
'use strict';
// #3763 (Epic #3719 P1-e): required-PR-gate runner. Validates ONLY the wiki pages changed in a
// PR against config/wiki-frontmatter.schema.json (validator = source of truth), excluding
// navigational non-page files. Pure gateFiles() is unit-tested; CLI exits non-zero on any invalid
// changed page so frontmatter divergence cannot re-accrue (root cause of the #3068 schema drift).
const path = require('path');
const fs = require('fs');
const { validateFile } = require('./validate-frontmatter.js');

// Navigational / index files that legitimately carry no page frontmatter (grandfathered; #3767).
const NAV_BASENAMES = new Set(['README.md', 'index.md', 'log.md', 'WIKI.md']);
const NAV_PREFIX = /^WIKI-.*\.md$/; // WIKI-operations.md, WIKI-typology.md, ...

/**
 * Is this changed path a wiki page that the frontmatter contract applies to?
 * @param {string} file - repo-relative changed-file path
 * @returns {boolean} true for wiki/**.md that is not a navigational/index file
 */
function isWikiPage(file) {
  const norm = String(file).replace(/\\/g, '/');
  if (!norm.startsWith('wiki/')) return false;
  if (!norm.endsWith('.md')) return false;
  const base = path.basename(norm);
  if (NAV_BASENAMES.has(base)) return false;
  if (NAV_PREFIX.test(base)) return false;
  return true;
}

/**
 * Partition changed files, validate the wiki pages, and return a structured report (pure/testable).
 * @param {string[]} files - changed-file paths from the PR diff
 * @param {{validate?: function}} [opts] - injectable validator (defaults to validateFile)
 * @returns {{checked: string[], skipped: string[], invalid: Array<{file: string, errors: string[]}>, ok: boolean}} report with the checked/skipped/invalid partition and overall ok flag
 */
function gateFiles(files, opts = {}) {
  const skipped = [];
  const checked = [];
  const invalid = [];
  for (const changedFile of files || []) {
    if (!isWikiPage(changedFile)) { skipped.push(changedFile); continue; }
    const validate = opts.validate || validateFile;
    // A page deleted in the PR (present in the diff, absent on disk) can't be invalid — skip it.
    if (!opts.validate && !fs.existsSync(changedFile)) { skipped.push(changedFile); continue; }
    checked.push(changedFile);
    let res;
    try { res = validate(changedFile, { verifySignature: false }); }
    catch (err) { res = { valid: false, errors: [`unreadable/unparseable: ${err.message}`] }; }
    if (!res.valid) invalid.push({ file: changedFile, errors: res.errors });
  }
  return { checked, skipped, invalid, ok: invalid.length === 0 };
}

module.exports = { gateFiles, isWikiPage, NAV_BASENAMES, NAV_PREFIX };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (files.length === 0) { console.log('wiki-frontmatter-gate: no changed files provided; pass.'); process.exit(0); }
  const report = gateFiles(files);
  if (report.checked.length === 0) {
    console.log(`wiki-frontmatter-gate: no changed wiki pages (skipped ${report.skipped.length}); pass.`);
    process.exit(0);
  }
  if (report.ok) { console.log(`wiki-frontmatter-gate: ${report.checked.length} changed wiki page(s) valid.`); process.exit(0); }
  console.error(`wiki-frontmatter-gate: ${report.invalid.length} changed wiki page(s) FAIL the validator:`);
  for (const bad of report.invalid) {
    console.error(`  ✗ ${bad.file}`);
    for (const e of bad.errors) console.error(`      ${e}`);
  }
  console.error('Fix the frontmatter to match config/wiki-frontmatter.schema.json (Refs #3763).');
  process.exit(1);
}
