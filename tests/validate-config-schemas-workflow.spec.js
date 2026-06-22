'use strict';
// tests/validate-config-schemas-workflow.spec.js — golden-file + structural assertions for #1957 AC4.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WF = path.resolve(__dirname, '..', '.github/workflows/validate-config-schemas.yml');
const FIX = path.resolve(__dirname, 'fixtures/validate-config-schemas-workflow.yml');
const read = () => fs.readFileSync(WF, 'utf8');

test('golden-file byte-equality: workflow matches fixture snapshot', () => {
  assert.equal(fs.readFileSync(WF, 'utf8'), fs.readFileSync(FIX, 'utf8'));
});

test('workflow triggers on pull_request to main (AC4 trigger #1)', () => {
  const y = read();
  assert.match(y, /pull_request:\s*\n\s+branches:\s+\[main\]/);
});

test('workflow triggers on push to main (AC4 trigger #2)', () => {
  const y = read();
  assert.match(y, /push:\s*\n\s+branches:\s+\[main\]/);
});

test('workflow runs the validator script (AC1 binding)', () => {
  const y = read();
  assert.match(y, /node scripts\/global\/validate-config-schemas\.js/);
});

test('workflow runs the regression-fixture assertion (AC3 binding)', () => {
  const y = read();
  assert.match(y, /node --test tests\/validate-config-schemas\.spec\.js/);
});

test('workflow installs Python jsonschema (Draft 2020-12 compatible)', () => {
  const y = read();
  assert.match(y, /python3 -m pip install jsonschema/);
});

test('workflow has minimal contents:read permissions (no write surfaces)', () => {
  const y = read();
  assert.match(y, /permissions:\s*\n\s+contents:\s+read/);
  assert.doesNotMatch(y, /contents:\s+write/);
  assert.doesNotMatch(y, /issues:\s+write/);
});

test('workflow has concurrency group keyed by ref (re-run safety)', () => {
  const y = read();
  assert.match(y, /concurrency:\s*\n\s+group:\s+validate-config-schemas-\$\{\{ github\.ref \}\}/);
});

test('workflow paths include all cross-runtime config surfaces', () => {
  const y = read();
  for (const p of ['\\.claude/', '\\.codex/', 'config/']) {
    assert.match(y, new RegExp(p), `missing path: ${p}`);
  }
});

test('job name matches expected required-status-check identifier', () => {
  const y = read();
  assert.match(y, /^\s*name:\s+validate-config-schemas\s*$/m);
});
