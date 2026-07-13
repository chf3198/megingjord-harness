#!/usr/bin/env node
'use strict';
// #3772 (Epic #3719): enforce secret redaction on the wiki write-path. The wiki contract long claimed
// "log-redaction + validate-at-write" but the code never applied it — a credential in a mirrored ticket/PR
// body would be committed verbatim. This module provides (a) redactSecrets() for prevent-at-write in
// wiki-io.js and (b) scanFiles() for the required changed-files CI backstop. Credential-class only
// (anthropic/openai/github-pat/github-fine-grained-pat/aws/jwt/bearer) — email/ipv4 (PII) stay advisory so
// legitimate technical wiki content (example IPs, contact addresses) is not corrupted.
const path = require('path');
const fs = require('fs');
const { getPatterns } = require('../global/log-redaction.js');

const PII_IDS = new Set(['email', 'ipv4']);

/** The credential-class subset of the redaction patterns (excludes PII email/ipv4). */
function credentialPatterns() {
  return getPatterns().filter((p) => !PII_IDS.has(p.id));
}

/**
 * Redact credential-class secrets from text (prevent-at-write).
 * @param {string} text - content about to be written
 * @returns {{text: string, hits: Array<{id: string, action: string}>}} redacted text + which patterns fired
 */
function redactSecrets(text) {
  if (typeof text !== 'string') return { text, hits: [] };
  const patterns = credentialPatterns();
  let out = text;
  const hits = [];
  for (const pat of patterns) {
    pat.compiled.lastIndex = 0;
    if (!pat.compiled.test(out)) continue;
    pat.compiled.lastIndex = 0;
    out = out.replace(pat.compiled, () => { hits.push({ id: pat.id, action: pat.action }); return pat.replacement || '<REDACTED>'; });
  }
  return { text: out, hits };
}

function isWikiPage(file) {
  const norm = String(file).replace(/\\/g, '/');
  return norm.startsWith('wiki/') && norm.endsWith('.md');
}

/**
 * Scan changed files for credential-class secrets (CI backstop above the write path).
 * @param {string[]} files - changed-file paths
 * @param {{read?: function}} [opts] - injectable reader for tests
 * @returns {{findings: Array<{file: string, patterns: string[]}>, checked: string[], ok: boolean}}
 */
function scanFiles(files, opts = {}) {
  const read = opts.read || ((f) => fs.readFileSync(f, 'utf-8'));
  const findings = [];
  const checked = [];
  for (const file of files || []) {
    if (!isWikiPage(file)) continue;
    if (!opts.read && !fs.existsSync(file)) continue;
    checked.push(file);
    let content = '';
    try { content = read(file); } catch { continue; }
    const { hits } = redactSecrets(content);
    if (hits.length) findings.push({ file, patterns: [...new Set(hits.map((h) => h.id))] });
  }
  return { findings, checked, ok: findings.length === 0 };
}

module.exports = { redactSecrets, scanFiles, isWikiPage, credentialPatterns, PII_IDS };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.log('wiki-secret-scan: no files provided; pass.'); process.exit(0); }
  const report = scanFiles(files);
  if (report.checked.length === 0) { console.log(`wiki-secret-scan: no changed wiki pages (pass).`); process.exit(0); }
  if (report.ok) { console.log(`wiki-secret-scan: ${report.checked.length} changed wiki page(s) secret-free.`); process.exit(0); }
  console.error(`wiki-secret-scan: credential-class secret(s) found in ${report.findings.length} changed wiki page(s):`);
  for (const finding of report.findings) console.error(`  ✗ ${finding.file} — ${finding.patterns.join(', ')}`);
  console.error('Remove/rotate the secret before committing (Refs #3772). Never commit live credentials.');
  process.exit(1);
}
