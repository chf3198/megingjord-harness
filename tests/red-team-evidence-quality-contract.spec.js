'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const V = require('../scripts/global/megalint/red-team-evidence-quality.js');

const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

test('detects RED_TEAM_ANALYSIS markers', () => {
  assert.equal(V.isRedTeamArtifact('## RED_TEAM_ANALYSIS\ntext'), true);
  assert.equal(V.isRedTeamArtifact('<!-- red-team-analysis -->\ntext'), true);
  assert.equal(V.isRedTeamArtifact('plain comment'), false);
});

test('passes on diff-grounded artifact with failure chain', () => {
  const commentBody = fixture('red-team-evidence-quality-pass.md');
  const changedFiles = [
    'scripts/global/megalint/red-team-evidence-quality.js',
    '.github/workflows/red-team-evidence-quality-advisory.yml',
  ];
  const result = V.validate({ commentBody, changedFiles });
  assert.equal(result.ok, true);
  assert.equal(result.violations.length, 0);
});

test('fails generic artifact lacking diff refs and failure chain', () => {
  const commentBody = fixture('red-team-evidence-quality-fail.md');
  const changedFiles = ['scripts/global/megalint/red-team-evidence-quality.js'];
  const result = V.validate({ commentBody, changedFiles });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some(v => v.rule === 'missing-diff-file-reference'));
  assert.ok(result.violations.some(v => v.rule === 'missing-failure-chain'));
});

test('requires out-of-scope marker for access-control claims without auth diff', () => {
  const commentBody = '## RED_TEAM_ANALYSIS\nRef: scripts/global/megalint/red-team-evidence-quality.js\nFailure chain: parser accepts weak signal.\nAccess-control could be bypassed.';
  const changedFiles = ['scripts/global/megalint/red-team-evidence-quality.js'];
  const result = V.validate({ commentBody, changedFiles });
  assert.equal(result.ok, false);
  assert.ok(result.violations.some(v => v.rule === 'missing-access-control-scope'));
});
