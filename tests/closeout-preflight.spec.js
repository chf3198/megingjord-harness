'use strict';

const { test, expect } = require('@playwright/test');
const { spawnSync } = require('node:child_process');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '..', 'scripts', 'global', 'closeout-preflight.js');
const preflight = require('../scripts/global/closeout-preflight.js');

function runWith(issueJson, branch, prBody) {
  const env = {
    ...process.env,
    CLOSEOUT_PREFLIGHT_BRANCH: branch,
    CLOSEOUT_PREFLIGHT_ISSUE_JSON: JSON.stringify(issueJson),
  };
  // A non-empty PR body simulates "PR exists"; omitting it simulates "no PR yet"
  // (the deferred-final pre-PR push state) — #3169.
  if (prBody !== undefined) env.CLOSEOUT_PREFLIGHT_PR_BODY = prBody;
  return spawnSync(process.execPath, [SCRIPT], { env, encoding: 'utf8' });
}

const MANAGER_HANDOFF_FIXTURE =
  'MANAGER_HANDOFF\nscope: fix pre-push\nlane: lane:code-change\ntest_strategy: tdd-pyramid\n'
  + 'acceptance: pass/fail\ngates: CI\nrelated_tickets: #3008\noverlap_decision: none\n'
  + 'Signed-by: Orla Mason\nTeam&Model: claude-code:opus@anthropic\nRole: manager';

const CONSULTANT_CLOSEOUT_FIXTURE =
  '## CONSULTANT_CLOSEOUT\nstatus: review\nverdict: approve_for_merge\n'
  + 'verification-timestamp: 2026-06-21T00:00:00Z\n'
  + 'rubric_rating: G1:9 G2:9 G3:9 G4:9 G5:9 G6:9 G7:9 G8:9 G9:9 -> min(G1..G9)=9, rubric 9/10\n'
  + 'anneal_tickets_filed: none\nmid_flight_flaws: none\n'
  + 'Signed-by: Orla Vale\nTeam&Model: claude-code:opus@anthropic\nRole: consultant';

test('closeout-preflight passes when linked issue has a valid consultant closeout', () => {
  const result = runWith({
    title: 'D3 local closeout preflight',
    body: 'Fix pre-push hook',
    comments: [
      { body: MANAGER_HANDOFF_FIXTURE },
      { body: CONSULTANT_CLOSEOUT_FIXTURE },
    ],
    labels: ['lane:code-change'],
    state: 'open',
  }, 'fix/1566-closeout-preflight');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('PASS #1566');
});

test('closeout-preflight enforces consultant closeout once the PR exists (AC2)', () => {
  // PR body present (simulating PR-open) -> consultant-closeout is required again.
  const result = runWith({
    title: 'D3 local closeout preflight',
    body: 'Fix pre-push hook',
    comments: [{ body: MANAGER_HANDOFF_FIXTURE }],
    labels: ['lane:code-change'],
    state: 'open',
  }, 'fix/1566-closeout-preflight', 'Refs #1566\nmerge-evidence-deferred-final: #1566');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('missing-consultant-closeout');
});

test('closeout-preflight defers consultant closeout pre-PR in deferred-final flow (AC1)', () => {
  // No PR body and no closeout posted yet -> consultant-closeout is deferred, not required.
  const result = runWith({
    title: 'D3 local closeout preflight',
    body: 'Fix pre-push hook',
    comments: [{ body: MANAGER_HANDOFF_FIXTURE }],
    labels: ['lane:code-change'],
    state: 'open',
  }, 'fix/1566-closeout-preflight');
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('deferred to PR-open');
  expect(result.stdout).toContain('PASS #1566');
});

test('closeout-preflight still validates an early-posted closeout pre-PR', () => {
  // A team that posts a (malformed) closeout early is still checked — deferral
  // relaxes ordering, it does not silently un-check a present closeout.
  const result = runWith({
    title: 'D3 local closeout preflight',
    body: 'Fix pre-push hook',
    comments: [
      { body: MANAGER_HANDOFF_FIXTURE },
      { body: '## CONSULTANT_CLOSEOUT\n(no required fields)' },
    ],
    labels: ['lane:code-change'],
    state: 'open',
  }, 'fix/1566-closeout-preflight');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('consultant-closeout');
});

test('selectPreflightValidators defers closeout only when no PR and no closeout', () => {
  const noPr = preflight.selectPreflightValidators(false, false);
  expect(noPr.validators).toEqual(['manager-handoff']);
  expect(noPr.closeoutDeferred).toBe(true);

  const prExists = preflight.selectPreflightValidators(true, false);
  expect(prExists.validators).toContain('consultant-closeout');
  expect(prExists.validators).toContain('merge-evidence-pr-gate');
  expect(prExists.closeoutDeferred).toBe(false);

  const earlyCloseout = preflight.selectPreflightValidators(false, true);
  expect(earlyCloseout.validators).toContain('consultant-closeout');
  expect(earlyCloseout.validators).not.toContain('merge-evidence-pr-gate');
  expect(earlyCloseout.closeoutDeferred).toBe(false);
});

test('hasCloseoutComment detects a CONSULTANT_CLOSEOUT artifact, not a prose mention', () => {
  expect(preflight.hasCloseoutComment([{ body: '## CONSULTANT_CLOSEOUT\nx' }])).toBe(true);
  expect(preflight.hasCloseoutComment([{ body: 'CONSULTANT_CLOSEOUT\nx' }])).toBe(true);
  expect(preflight.hasCloseoutComment([{ body: 'MANAGER_HANDOFF' }])).toBe(false);
  // Prose mention inside another artifact must NOT count as a posted closeout (#3169).
  expect(preflight.hasCloseoutComment([
    { body: 'MANAGER_HANDOFF\nscope: defer the CONSULTANT_CLOSEOUT check to PR-open' },
  ])).toBe(false);
  expect(preflight.hasCloseoutComment([])).toBe(false);
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
      { body: 'MANAGER_HANDOFF\nscope: docs\nlane: lane:docs-only\ntest_strategy: peer-review\nacceptance: ok\ngates: peer\nrelated_tickets: #1639\noverlap_decision: none\nSigned-by: Orla Mason\nTeam&Model: claude-code:opus@anthropic\nRole: manager' },
      { body: CONSULTANT_CLOSEOUT_FIXTURE },
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

test('readIssue supports MCP path when forced', async () => {
  let tool = '';
  const issue = await preflight.readIssue(1995, {
    env: { MEGINGJORD_MCP_FORCE_AVAILABLE: '1' },
    mcpClient: { invoke: async (name) => { tool = name; return { issue: { title: 'T', body: '', comments: [], labels: [], state: 'open' } }; } },
  });
  expect(tool).toBe('mcp__github__get_issue');
  expect(issue.title).toBe('T');
});

test('fetchPrBody supports MCP path when forced', async () => {
  let tool = '';
  const body = await preflight.fetchPrBody('fix/1995-closeout-preflight-mcp', {
    env: { MEGINGJORD_MCP_FORCE_AVAILABLE: '1' },
    mcpClient: { invoke: async (name) => { tool = name; return { pullRequest: { body: 'hello from mcp' } }; } },
  });
  expect(tool).toBe('mcp__github__get_pull_request');
  expect(body).toBe('hello from mcp');
});

test('readIssue honors MCP-disabled CLI fallback', async () => {
  let args = [];
  const issue = await preflight.readIssue(1995, {
    env: { MEGINGJORD_MCP_DISABLED: '1' },
    cliRunner: async (_cmd, cliArgs) => {
      args = cliArgs;
      return { stdout: JSON.stringify({ title: 'CLI', body: '', comments: [], labels: [], state: 'open' }), stderr: '' };
    },
  });
  expect(args.slice(0, 3)).toEqual(['issue', 'view', '1995']);
  expect(issue.title).toBe('CLI');
});
