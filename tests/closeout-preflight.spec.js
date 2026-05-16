'use strict';

const { test, expect } = require('@playwright/test');
const { spawnSync } = require('node:child_process');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'global', 'closeout-preflight.js');

function runWith(issueJson, branch) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      CLOSEOUT_PREFLIGHT_BRANCH: branch,
      CLOSEOUT_PREFLIGHT_ISSUE_JSON: JSON.stringify(issueJson),
    },
    encoding: 'utf8',
  });
}

test('closeout-preflight passes when linked issue has a valid consultant closeout', () => {
  const result = runWith({
    title: 'D3 local closeout preflight',
    body: 'Fix pre-push hook',
    comments: [
      { body: 'MANAGER_HANDOFF\nscope: fix pre-push\nlane: lane:code-change\ntest_strategy: unit\nacceptance: pass/fail\ngates: CI\nSigned-by: Soren Mason\nTeam&Model: copilot:model\nRole: manager' },
      { body: '## CONSULTANT_CLOSEOUT\nrubric: G1=9, G2=8\nverification-timestamp: 2026-05-14T23:00:00Z\nverdict: approved\nSigned-by: Soren Vale\nTeam&Model: copilot:model\nRole: consultant\nSee #1566' },
    ],
    labels: [],
    state: 'open',
  }, 'feat/1566-closeout-preflight');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('PASS #1566');
});

test('closeout-preflight fails when linked issue lacks consultant closeout', () => {
  const result = runWith({
    title: 'EPIC: D3 local closeout preflight',
    body: '## Epic Summary\nChild: #1564',
    comments: [],
    labels: [],
    state: 'open',
  }, 'feat/1566-closeout-preflight');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('missing-consultant-closeout');
});

test('closeout-preflight skips branches without ticket numbers', () => {
  const result = runWith({ title: 'misc', body: '', comments: [] }, 'main');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('skip');
});

test('closeout-preflight derives lane from labels when handoff is docs-only', () => {
  const result = runWith({
    title: 'D Test',
    body: '',
    comments: [
      { body: 'MANAGER_HANDOFF\nscope: docs\nlane: lane:docs-only\ntest_strategy: peer-review\nacceptance: ok\ngates: peer\nSigned-by: Orla Mason\nTeam&Model: claude-code:opus@anthropic\nRole: manager' },
      { body: '## CONSULTANT_CLOSEOUT\nG1=9\nverification-timestamp: 2026-05-15T00:00:00Z\nverdict: approved\nSigned-by: Orla Vale\nTeam&Model: claude-code:opus@anthropic\nRole: consultant\nrubric_rating: 9/10' },
    ],
    labels: ['lane:docs-only', 'type:doc'],
    state: 'open',
  }, 'fix/1639-derives-lane');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('PASS #1639');
});

test('closeout-preflight skips when SKIP_CLOSEOUT_PREFLIGHT=1', () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      SKIP_CLOSEOUT_PREFLIGHT: '1',
      CLOSEOUT_PREFLIGHT_BRANCH: 'feat/1566-closeout-preflight',
      CLOSEOUT_PREFLIGHT_ISSUE_JSON: JSON.stringify({ title: 'D3', body: '', comments: [], labels: [], state: 'open' }),
    },
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('skipped');
});