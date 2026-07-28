'use strict';
// tests/cross-team-consult-workflows.spec.js — golden-file fixtures for #1592 AC5 of #1334.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');

const TRIO = [
  ['cross-team-claim-reaper.yml', 'cross-team-claim-reaper-workflow.yml', '#1589'],
  ['cross-team-auto-apply.yml', 'cross-team-auto-apply-workflow.yml', '#1590'],
  ['cross-team-signer-substrate-advisory.yml', 'cross-team-signer-substrate-advisory-workflow.yml', '#1334 AC1'],
];

function read(wf, fix) {
  const workflow = path.join(ROOT, '.github/workflows', wf);
  const fixture = path.join(FIX, fix);
  return { yml: fs.readFileSync(workflow, 'utf8'), fixture };
}

for (const [wf, fix, ref] of TRIO) {
  test(`${wf} golden-file byte-equality (${ref})`, () => {
    const { yml, fixture } = read(wf, fix);
    assert.equal(yml, fs.readFileSync(fixture, 'utf8'));
  });
}

test('claim-reaper: daily cron + reaper helper + in-progress label scan', () => {
  const { yml } = read('cross-team-claim-reaper.yml', 'cross-team-claim-reaper-workflow.yml');
  assert.match(yml, /cron:\s+'17 6 \* \* \*'/);
  assert.match(yml, /cross-team-claim-reaper\.js/);
  assert.match(yml, /labels:\s+'consultant:cross-team-in-progress'/);
  assert.match(yml, /R\.buildExpiredComment/);
  assert.match(yml, /issues:\s+write/);
});

test('auto-apply: issue_comment trigger + decideApply helper + PR guard', () => {
  const { yml } = read('cross-team-auto-apply.yml', 'cross-team-auto-apply-workflow.yml');
  assert.match(yml, /issue_comment:/);
  assert.match(yml, /cross-team-auto-apply\.js/);
  assert.match(yml, /A\.decideApply/);
  assert.match(yml, /github\.event\.issue\.pull_request == null/);
  assert.match(yml, /labels:\s*\[decision\.label\]/);
});

test('signer-substrate advisory: PR gate + enforceSubstrateMatch + waiver path', () => {
  const { yml } = read('cross-team-signer-substrate-advisory.yml',
    'cross-team-signer-substrate-advisory-workflow.yml');
  assert.match(yml, /pull_request:\s*\n\s+branches:\s+\[main\]/);
  assert.match(yml, /cross-team-signer-substrate\.js/);
  assert.match(yml, /X\.enforceSubstrateMatch/);
  assert.match(yml, /signer-substrate:waived/);
  assert.match(yml, /Does not block merge/);
});

test('all three workflows pin actions/checkout and actions/github-script SHAs', () => {
  for (const [wf, fix] of TRIO) {
    const { yml } = read(wf, fix);
    assert.match(yml, /actions\/checkout@[0-9a-f]{40}/);
    assert.match(yml, /actions\/github-script@[0-9a-f]{40}/);
  }
});
