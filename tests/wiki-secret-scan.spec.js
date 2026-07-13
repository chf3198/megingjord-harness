'use strict';
// #3772 (Epic #3719): enforce secret redaction on the wiki write-path. tdd-pyramid.
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { redactSecrets, scanFiles, isWikiPage } = require('../scripts/wiki/wiki-secret-scan.js');
const { writePage } = require('../scripts/wiki/wiki-io.js');

const KEY = 'sk-ant-' + 'a'.repeat(40);
const PAT = 'ghp_' + 'b'.repeat(36);

test('redactSecrets scrubs credential-class secrets, preserves PII (email/ip)', () => {
  const r = redactSecrets(`token ${KEY} and ${PAT} and a@b.com and 10.0.0.1`);
  assert.ok(!r.text.includes(KEY) && !r.text.includes(PAT), 'credentials redacted');
  assert.ok(r.text.includes('a@b.com') && r.text.includes('10.0.0.1'), 'PII preserved (advisory-only)');
  assert.deepEqual([...new Set(r.hits.map((h) => h.id))].sort(), ['anthropic-key', 'github-pat']);
});

test('scanFiles flags a planted secret, passes clean, skips non-wiki', () => {
  const read = (f) => ({ 'wiki/work-log/tickets/1.md': `body ${KEY}`, 'wiki/wisdom/global/concepts/x.md': 'clean body', 'scripts/foo.js': KEY }[f]);
  const r = scanFiles(['wiki/work-log/tickets/1.md', 'wiki/wisdom/global/concepts/x.md', 'scripts/foo.js'], { read });
  assert.equal(r.ok, false);
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].file, 'wiki/work-log/tickets/1.md');
  assert.equal(r.checked.length, 2, 'only wiki pages checked (scripts/foo.js skipped)');
});

test('empty / non-wiki changed set no-ops green', () => {
  assert.equal(scanFiles([], { read: () => '' }).ok, true);
  assert.equal(scanFiles(['README.md'], { read: () => KEY }).ok, true);
});

test('writePage prevents a secret from ever being written (prevent-at-write)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki3772-'));
  fs.mkdirSync(path.join(root, 'work-log/tickets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.md'), '---\n---\n## Work Log\n');
  const p = writePage('42', 'ticket', `---\ntitle: t\n---\nleaked ${KEY}`, root, { allowExternalWikiDir: true });
  const written = fs.readFileSync(p, 'utf-8');
  assert.ok(!written.includes(KEY), 'secret never lands on disk');
  assert.ok(written.includes('REDACTED'), 'redaction placeholder present');
});

test('GOLDEN: workflow is required-safe (runs on all PRs, not advisory)', () => {
  const yml = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/wiki-secret-scan.yml'), 'utf8');
  assert.match(yml, /on:\s*\n\s*pull_request:\s*\n(?!\s*paths)/);
  assert.ok(!/continue-on-error:\s*true/.test(yml), 'gate must not be advisory');
  assert.match(yml, /wiki-secret-scan\.js/);
});
