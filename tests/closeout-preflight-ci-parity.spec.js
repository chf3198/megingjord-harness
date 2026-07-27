'use strict';
// #3657 — shift-left CI parity: the LOCAL pre-push closeout-preflight must reject the
// SAME baton-artifact FORMAT defects CI's baton-gates rejects, BEFORE PR-open, so the
// #3631 friction cascade (artifact errors surfacing one-by-one at CI) cannot recur.
// Covers: collaborator-handoff full-field parity (cross_family_receipt underscore,
// worktree_behind_main), changelog-fragment-presence (#3691), signer-fidelity, and the
// invariants that pre-artifact pushes never false-fail (AC3) and the anti-forgery
// ledger-membership check is CI/merge-owned, not a local block (AC4 / not parity-lowering).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'global', 'closeout-preflight.js');
// A synthetic branch with no real PR keeps the run deterministic (no live gh state).
const BRANCH = 'fix/3657-ci-parity-spec-fixture';
const LABELS = ['lane:code-change', 'area:scripts'];
const FRAGMENT = '.changes/unreleased/3657.md';

const MANAGER =
  '## MANAGER_HANDOFF\nscope: shift-left CI parity\nlane: lane:code-change\n'
  + 'test_strategy: tdd-pyramid\nacceptance:\nAC1 local==CI\ngates: CI\n'
  + 'related_tickets: #3656\noverlap_decision: none\n'
  + `worktree_branch: ${BRANCH}\n`
  + 'Signed-by: Orla Mason\nTeam&Model: claude-code:claude-opus-4-8@local\nRole: manager';

const DOC_BLOCK =
  'doc-coverage:\n'
  + `  .changes/unreleased/: UPDATED: ${FRAGMENT}\n`
  + '  README.md: N/A: no-user-visible-change — internal validator wiring\n'
  + '  docs/howto/: N/A: out-of-scope — no operator-runbook change';

// A COMPLETE, CI-valid COLLABORATOR_HANDOFF (all lane:code-change fields present).
// The 16-hex receipt is intentionally NOT in the consensus ledger — the local gate
// must still PASS it (ledger-membership anti-forgery is CI/merge-owned, #3678 F1).
function collab(overrides = {}) {
  const f = {
    receiptKey: 'cross_family_receipt', behind: 'worktree_behind_main: 0\n',
    signer: 'Orla Harper', doc: DOC_BLOCK, ...overrides,
  };
  return '## COLLABORATOR_HANDOFF\nticket: #3657\n' + f.doc + '\n'
    + 'cross_family_reviewer: qwen2.5-coder:32b@100.91.113.16:11434\n'
    + 'cross_family_rating: 92/100\ncross_family_findings: none blocking\n'
    + `${f.receiptKey}: 0123456789abcdef\n`
    + `worktree_branch: ${BRANCH}\n${f.behind}`
    + 'Pre-handoff verification (PASS)\n- [x] lint\n- [x] tests\n'
    + `Signed-by: ${f.signer}\nTeam&Model: claude-code:claude-opus-4-8@local\nRole: collaborator`;
}

function runPreflight(comments, prFiles) {
  const issue = { title: 'ci-parity fixture', body: 'body', comments, labels: LABELS, state: 'open' };
  return spawnSync(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      CLOSEOUT_PREFLIGHT_BRANCH: BRANCH,
      CLOSEOUT_PREFLIGHT_ISSUE_JSON: JSON.stringify(issue),
      CLOSEOUT_PREFLIGHT_PR_FILES: prFiles,
    },
    encoding: 'utf8',
  });
}

const okFiles = `${FRAGMENT},scripts/global/closeout-preflight.js`;

test('AC2: a complete CI-valid COLLABORATOR_HANDOFF passes local pre-push', () => {
  const r = runPreflight([{ body: MANAGER }, { body: collab() }], okFiles);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS #3657/);
});

test('AC4: an unledgered cross_family_receipt still PASSES locally (anti-forgery is CI/merge-owned)', () => {
  const r = runPreflight([{ body: MANAGER }, { body: collab() }], okFiles);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(r.stderr, /cross-family-receipt-unledgered/);
});

test('AC1: a hyphenated cross-family-receipt (the #3631 friction) fails local pre-push', () => {
  const r = runPreflight([{ body: MANAGER }, { body: collab({ receiptKey: 'cross-family-receipt' }) }], okFiles);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL \[collaborator-handoff\]/);
  assert.match(r.stderr, /missing-cross-family-receipt/);
});

test('AC1: a missing worktree_behind_main fails local pre-push', () => {
  const r = runPreflight([{ body: MANAGER }, { body: collab({ behind: '' }) }], okFiles);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /missing-worktree-behind/);
});

test('AC1 (#3691): a lane:code-change handoff without a changelog fragment fails local pre-push', () => {
  const r = runPreflight([{ body: MANAGER }, { body: collab() }], 'scripts/global/closeout-preflight.js');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL \[changelog-fragment\]/);
  assert.match(r.stderr, /missing-fragment/);
});

test('AC1: a wrong signer alias on the handoff fails signer-fidelity locally', () => {
  const r = runPreflight([{ body: MANAGER }, { body: collab({ signer: 'Wrong Person' }) }], okFiles);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL \[signer-fidelity\]/);
});

test('AC3: a pre-artifact push (MANAGER_HANDOFF only, no COLLABORATOR_HANDOFF) still PASSES', () => {
  const r = runPreflight([{ body: MANAGER }], 'scripts/global/closeout-preflight.js');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS #3657/);
});
