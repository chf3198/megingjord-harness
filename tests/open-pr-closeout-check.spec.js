'use strict';

const { test, expect } = require('@playwright/test');
const { decide, run, OVERRIDE_MARKER } = require('../scripts/global/open-pr-closeout-check.js');

const FINDING = [{ pr: 7, issue: 200 }];

test('decide: clean state passes (exit 0, not blocked)', () => {
  const result = decide([], { blockMode: false, overridden: false });
  expect(result).toMatchObject({ exitCode: 0, blocked: false });
  expect(result.message).toContain('OK');
});

test('decide: finding in advisory mode warns but does not block', () => {
  const result = decide(FINDING, { blockMode: false, overridden: false });
  expect(result.exitCode).toBe(0);
  expect(result.blocked).toBe(false);
  expect(result.message).toContain('WARNING');
  expect(result.message).toContain('PR #7 -> issue #200');
});

test('decide: finding in block mode exits 1', () => {
  const result = decide(FINDING, { blockMode: true, overridden: false });
  expect(result.exitCode).toBe(1);
  expect(result.blocked).toBe(true);
  expect(result.message).toContain('BLOCKED');
});

test('decide: override marker skips even in block mode', () => {
  const result = decide(FINDING, { blockMode: true, overridden: true });
  expect(result.exitCode).toBe(0);
  expect(result.blocked).toBe(false);
  expect(result.message).toContain(OVERRIDE_MARKER);
});

function fetchers(prs, issues) {
  return {
    listOpenPRs: async () => prs,
    getIssue: async (n) => issues[n] || { comments: [] },
  };
}

test('run: open PR without closeout warns in advisory mode (exit 0)', async () => {
  const result = await run({
    blockMode: false, commitSubject: 'feat: x',
    fetchers: fetchers([{ number: 7, body: 'Refs #200' }], { 200: { comments: [] } }),
  });
  expect(result.exitCode).toBe(0);
  expect(result.message).toContain('PR #7 -> issue #200');
});

test('run: open PR without closeout blocks when CLOSEOUT_CHECK_BLOCK', async () => {
  const result = await run({
    blockMode: true, commitSubject: 'feat: x',
    fetchers: fetchers([{ number: 7, body: 'Refs #200' }], { 200: { comments: [] } }),
  });
  expect(result.exitCode).toBe(1);
});

test('run: override marker in commit subject skips the scan', async () => {
  const result = await run({
    blockMode: true, commitSubject: `fix: y ${OVERRIDE_MARKER}`,
    fetchers: fetchers([{ number: 7, body: 'Refs #200' }], { 200: { comments: [] } }),
  });
  expect(result.exitCode).toBe(0);
  expect(result.message).toContain(OVERRIDE_MARKER);
});

test('run: PR with a closeout is a clean pass', async () => {
  const result = await run({
    blockMode: true, commitSubject: 'feat: x',
    fetchers: fetchers([{ number: 8, body: 'Closes #201' }], { 201: { comments: [{ body: '## CONSULTANT_CLOSEOUT' }] } }),
  });
  expect(result.exitCode).toBe(0);
  expect(result.message).toContain('OK');
});

test('run: no open PRs is a clean pass', async () => {
  const result = await run({ blockMode: true, commitSubject: 'feat: x', fetchers: fetchers([], {}) });
  expect(result.exitCode).toBe(0);
});
