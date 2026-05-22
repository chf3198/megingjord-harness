'use strict';
const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');
const cp = require('node:child_process');
const { lintTicketRedundancy, getTokens, normalizeToken } = require('../scripts/global/lint-ticket-redundancy.js');

let originalExec = cp.execFileSync;
let mockResponse = '';

beforeEach(() => {
  mockResponse = '';
  cp.execFileSync = (cmd, args) => {
    if (args.includes('list')) {
      return mockResponse;
    }
    return '';
  };
});

afterEach(() => {
  cp.execFileSync = originalExec;
});

test('normalizeToken normalizes words, strips punctuation, and maps synonyms', () => {
  assert.equal(normalizeToken('crashes!'), 'crash');
  assert.equal(normalizeToken('SpawnSync'), 'execute');
  assert.equal(normalizeToken('the'), null);
  assert.equal(normalizeToken(''), null);
  assert.equal(normalizeToken('linter-gate'), 'lintergate');
});

test('getTokens extracts canonical word sets', () => {
  const tokens = getTokens('The spawnSync engine crashed due to an exception');
  assert.ok(tokens.has('execute'));
  assert.ok(tokens.has('crash'));
  assert.ok(tokens.has('engine'));
  assert.ok(!tokens.has('the'));
});

test('lintTicketRedundancy passes when backlog is empty', () => {
  mockResponse = JSON.stringify([]);
  const findings = lintTicketRedundancy();
  assert.equal(findings.length, 0);
});

test('lintTicketRedundancy flags duplicate tickets with synonym expansion', () => {
  mockResponse = JSON.stringify([
    {
      number: 1,
      title: 'Fix spawnSync failures in execution engine',
      body: 'Resolve exceptions and exception failures when running execution loops'
    },
    {
      number: 2,
      title: 'Resolve spawn failures in execution engine',
      body: 'Resolve exceptions and exception failures when executing execution loops'
    }
  ]);

  const findings = lintTicketRedundancy();
  assert.equal(findings.length, 1);
  assert.equal(findings[0].pair[0], 1);
  assert.equal(findings[0].pair[1], 2);
  assert.ok(findings[0].similarity >= 0.70);
});

test('lintTicketRedundancy ignores tickets with disjoint titles/bodies', () => {
  mockResponse = JSON.stringify([
    {
      number: 1,
      title: 'Implement database backup cron job',
      body: 'Schedule daily postgres dump uploads to AWS S3 bucket'
    },
    {
      number: 2,
      title: 'Refactor UI button styling parameters',
      body: 'Update TailwindCSS primary button classes forOutfit typography'
    }
  ]);

  const findings = lintTicketRedundancy();
  assert.equal(findings.length, 0);
});
