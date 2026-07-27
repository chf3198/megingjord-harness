'use strict';
// #3636 — closeout-preflight must NOT demand a CONSULTANT_CLOSEOUT during an ACTIVE-review
// rework push. After a cross-family REQUEST-CHANGES (or on a draft PR) the closeout is
// CORRECTLY absent (review not re-approved); enforcing it at pre-push inverts the baton.
// The exemption relaxes ORDERING only — close-time enforcement (CI consultant-gate,
// merge-evidence-pr-gate, pretool_guard close gate) is unchanged. A closeout that IS already
// posted stays validated (deferral never un-checks a present closeout).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'global', 'closeout-preflight.js');
const preflight = require('../scripts/global/closeout-preflight.js');
const BRANCH = 'fix/3636-rework-spec-fixture';

const MANAGER = '## MANAGER_HANDOFF\nscope: rework exemption\nlane: lane:code-change\n'
  + 'test_strategy: tdd-pyramid\nacceptance:\nAC1 rework passes\ngates: CI\n'
  + 'related_tickets: #3656\noverlap_decision: none\n'
  + `worktree_branch: ${BRANCH}\n`
  + 'Signed-by: Orla Mason\nTeam&Model: claude-code:claude-opus-4-8@local\nRole: manager';
const MALFORMED_CLOSEOUT = '## CONSULTANT_CLOSEOUT\n(no required fields)';
const PR_BODY = 'Refs #3636\nmerge-evidence-deferred-final: #3636';

function run({ comments, rework, prBody = PR_BODY }) {
  const issue = { title: 'rework fixture', body: 'b', comments, labels: ['lane:code-change'], state: 'open' };
  const env = {
    ...process.env,
    CLOSEOUT_PREFLIGHT_BRANCH: BRANCH,
    CLOSEOUT_PREFLIGHT_ISSUE_JSON: JSON.stringify(issue),
    CLOSEOUT_PREFLIGHT_PR_FILES: 'scripts/global/closeout-preflight.js',
    CLOSEOUT_PREFLIGHT_PR_REWORK: rework ? '1' : '0',
  };
  if (prBody !== null) env.CLOSEOUT_PREFLIGHT_PR_BODY = prBody;
  return spawnSync(process.execPath, [SCRIPT], { env, encoding: 'utf8' });
}

test('AC1/AC2: a rework push (CHANGES_REQUESTED / draft) with no closeout PASSES', () => {
  const r = run({ comments: [{ body: MANAGER }], rework: true });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /active-review rework/);
  assert.match(r.stdout, /PASS #3636/);
});

test('AC4: a NON-rework PR (review approved) with no closeout STILL enforces the closeout', () => {
  const r = run({ comments: [{ body: MANAGER }], rework: false });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /consultant-closeout/);
});

test('AC3: an already-posted closeout is STILL validated during rework (not silently skipped)', () => {
  const r = run({ comments: [{ body: MANAGER }, { body: MALFORMED_CLOSEOUT }], rework: true });
  assert.equal(r.status, 1, 'a malformed closeout must still fail even while rework-exempt');
  assert.match(r.stderr, /consultant-closeout/);
});

test('AC5 unit: selectPreflightValidators exempts closeout only in the rework state', () => {
  const rework = preflight.selectPreflightValidators(true, false, false, true);
  assert.ok(!rework.validators.includes('consultant-closeout'), 'rework PR: closeout deferred');
  assert.equal(rework.closeoutDeferred, true);
  const normal = preflight.selectPreflightValidators(true, false, false, false);
  assert.ok(normal.validators.includes('consultant-closeout'), 'normal PR: closeout enforced');
  // A posted closeout is validated even during rework.
  const posted = preflight.selectPreflightValidators(true, true, false, true);
  assert.ok(posted.validators.includes('consultant-closeout'));
});

test('unit: fetchPrReworkInReview maps the env override deterministically', async () => {
  const prev = process.env.CLOSEOUT_PREFLIGHT_PR_REWORK;
  process.env.CLOSEOUT_PREFLIGHT_PR_REWORK = '1';
  assert.equal(await preflight.fetchPrReworkInReview(BRANCH), true);
  process.env.CLOSEOUT_PREFLIGHT_PR_REWORK = '0';
  assert.equal(await preflight.fetchPrReworkInReview(BRANCH), false);
  if (prev === undefined) delete process.env.CLOSEOUT_PREFLIGHT_PR_REWORK;
  else process.env.CLOSEOUT_PREFLIGHT_PR_REWORK = prev;
});
