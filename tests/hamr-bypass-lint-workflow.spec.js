'use strict';
// tests/hamr-bypass-lint-workflow.spec.js — golden-file structural assertions for #1157.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW = path.resolve(__dirname, '..', '.github/workflows/hamr-bypass-lint.yml');

function readYaml() { return fs.readFileSync(WORKFLOW, 'utf8'); }

test('workflow file exists', () => {
  assert.ok(fs.existsSync(WORKFLOW), 'workflow file missing');
});

test('workflow name does NOT include "(advisory)" — post-promotion state per AC5', () => {
  const yml = readYaml();
  assert.match(yml, /^name:\s+HAMR Bypass Lint\s*$/m);
  assert.doesNotMatch(yml, /name:\s+HAMR Bypass Lint \(advisory\)/);
});

test('job display name does NOT include "(advisory)" — post-promotion state per AC5', () => {
  const yml = readYaml();
  assert.match(yml, /^\s*name:\s+HAMR-bypass detection\s*$/m);
  assert.doesNotMatch(yml, /name:\s+HAMR-bypass detection \(advisory\)/);
});

test('lint step has HAMR_BYPASS_GATE=1 env per AC1 (script switches OUT of advisory mode)', () => {
  const yml = readYaml();
  assert.match(yml, /env:\s*\n\s+HAMR_BYPASS_GATE:\s+['"]1['"]/);
});

test('lint step does NOT have continue-on-error: true per AC2 (makes failure blocking)', () => {
  const yml = readYaml();
  assert.doesNotMatch(yml, /continue-on-error:\s*true/);
});

test('NOTE step reflects post-promotion state, not pre-promotion advisory state', () => {
  const yml = readYaml();
  assert.doesNotMatch(yml, /advisory-first/);
  assert.match(yml, /Promoted to required per #1157/);
});

test('workflow still triggers on the same pull_request paths (no scope reduction)', () => {
  const yml = readYaml();
  for (const p of ['scripts/\\*\\*', 'dashboard/\\*\\*', 'hooks/\\*\\*', 'tests/\\*\\*']) {
    assert.match(yml, new RegExp(`-\\s+'${p}'`), `missing path: ${p}`);
  }
});

test('workflow still has the daily schedule trigger', () => {
  const yml = readYaml();
  assert.match(yml, /cron:\s+'23 7 \* \* \*'/);
});

test('permissions block remains minimal (contents: read only)', () => {
  const yml = readYaml();
  assert.match(yml, /permissions:\s*\n\s+contents:\s+read/);
  assert.doesNotMatch(yml, /issues:\s+write/);
  assert.doesNotMatch(yml, /contents:\s+write/);
});
