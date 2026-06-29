'use strict';
// #3328 — parity regression: the LOCAL pre-push closeout-preflight must reject the
// same baton-artifact FORMAT defects CI's collaborator-gate rejects (the #3315
// recurrence): a heading-form `### doc-coverage:` block, a non-enum N/A reason, and
// a labelled/missing MANAGER_HANDOFF `acceptance:` field. A correctly-formatted pair
// passes local and CI identically.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'global', 'closeout-preflight.js');
const preflight = require('../scripts/global/closeout-preflight.js');
const megalint = require('../scripts/global/megalint');
const collaboratorHandoff = require('../scripts/global/megalint/collaborator-handoff.js');

const BRANCH = 'fix/3328-local-preflight-doc-coverage';
const LABELS = ['lane:code-change', 'area:scripts'];

// A schema-valid MANAGER_HANDOFF with `acceptance:` content on its own (block) line —
// the canonical baton-builder form, which extractField parses correctly.
const MANAGER_HANDOFF_OK =
  '## MANAGER_HANDOFF\nscope: wire doc-coverage into preflight\nlane: lane:code-change\n'
  + 'test_strategy: tdd-pyramid\nacceptance:\nAC1 local==CI\ngates: CI\n'
  + 'related_tickets: #3315\noverlap_decision: none\n'
  + `worktree_branch: ${'fix/3328-local-preflight-doc-coverage'}\n`
  + 'Signed-by: Orla Mason\nTeam&Model: claude-code:claude-opus-4-8@local\nRole: manager';

// The defect form CI rejects: a labelled `acceptance (checklist):` header parses as
// missing-acceptance (the colon is not adjacent to the field name).
const MANAGER_HANDOFF_BAD_ACCEPTANCE =
  '## MANAGER_HANDOFF\nscope: wire doc-coverage into preflight\nlane: lane:code-change\n'
  + 'test_strategy: tdd-pyramid\nacceptance (checklist):\n- AC1\ngates: CI\n'
  + 'related_tickets: #3315\noverlap_decision: none\n'
  + `worktree_branch: ${'fix/3328-local-preflight-doc-coverage'}\n`
  + 'Signed-by: Orla Mason\nTeam&Model: claude-code:claude-opus-4-8@local\nRole: manager';

const DOC_BLOCK_OK =
  'doc-coverage:\n'
  + '  .changes/unreleased/: UPDATED: .changes/unreleased/3328.md\n'
  + '  README.md: N/A: no-user-visible-change — internal validator wiring\n'
  + '  docs/howto/: N/A: out-of-scope — no operator-runbook change';

// #2 the heading form `### doc-coverage:` is NOT recognized as a block header.
const DOC_BLOCK_HEADING =
  '### doc-coverage:\n'
  + '  .changes/unreleased/: UPDATED: .changes/unreleased/3328.md\n'
  + '  README.md: N/A: no-user-visible-change — internal validator wiring\n'
  + '  docs/howto/: N/A: out-of-scope — no operator-runbook change';

// #3 a non-enum N/A reason (the repeated surface path instead of an enum reason).
const DOC_BLOCK_BAD_NA =
  'doc-coverage:\n'
  + '  .changes/unreleased/: UPDATED: .changes/unreleased/3328.md\n'
  + '  README.md: N/A: README.md — repeated path not an enum reason\n'
  + '  docs/howto/: N/A: out-of-scope — no operator-runbook change';

const collabHandoff = (docBlock) =>
  `## COLLABORATOR_HANDOFF\nticket: #3328\n${docBlock}\n`
  + 'Signed-by: Orla Harper\nTeam&Model: claude-code:claude-opus-4-8@local\nRole: collaborator';

function runPreflight(managerBody, docBlock) {
  const issue = {
    title: 'Local closeout-preflight doc-coverage parity',
    body: 'Wire doc-coverage into the pre-push preflight',
    comments: [{ body: managerBody }, { body: collabHandoff(docBlock) }],
    labels: LABELS, state: 'open',
  };
  return spawnSync(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      CLOSEOUT_PREFLIGHT_BRANCH: BRANCH,
      CLOSEOUT_PREFLIGHT_ISSUE_JSON: JSON.stringify(issue),
    },
    encoding: 'utf8',
  });
}

// ---- AC2: correctly-formatted pair passes local pre-push ----
test('AC2: a well-formed MANAGER_HANDOFF + doc-coverage block passes local pre-push', () => {
  const r = runPreflight(MANAGER_HANDOFF_OK, DOC_BLOCK_OK);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /PASS #3328/);
});

// ---- AC1: each FORMAT defect now fails LOCALLY (matching CI) ----
test('AC1: a heading-form `### doc-coverage:` block fails local pre-push', () => {
  const r = runPreflight(MANAGER_HANDOFF_OK, DOC_BLOCK_HEADING);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL \[doc-coverage\]/);
  assert.match(r.stderr, /doc-coverage-missing/);
});

test('AC1: a non-enum N/A reason fails local pre-push', () => {
  const r = runPreflight(MANAGER_HANDOFF_OK, DOC_BLOCK_BAD_NA);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL \[doc-coverage\]/);
  assert.match(r.stderr, /doc-coverage-invalid-na/);
});

test('AC1: a labelled `acceptance (...)` MANAGER_HANDOFF fails local pre-push', () => {
  const r = runPreflight(MANAGER_HANDOFF_BAD_ACCEPTANCE, DOC_BLOCK_OK);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL \[manager-handoff\]/);
  assert.match(r.stderr, /missing-acceptance/);
});

// ---- Parity: the local `doc-coverage` validator and CI's collaborator-gate agree ----
test('parity: local doc-coverage verdict matches CI collaborator-gate doc-coverage path', () => {
  for (const [docBlock, expectOk] of [
    [DOC_BLOCK_OK, true], [DOC_BLOCK_HEADING, false], [DOC_BLOCK_BAD_NA, false],
  ]) {
    const comments = [{ body: collabHandoff(docBlock) }];
    // Local path: the megalint-registered doc-coverage validator (used by closeout-preflight).
    const local = megalint.run('doc-coverage', { comments, labels: LABELS, lane: 'lane:code-change' });
    // CI path: collaborator-handoff.validate runs the same doc-coverage checkBlock internally.
    const ci = collaboratorHandoff.validate({ comments, labels: LABELS });
    const ciDocBlocking = (ci.violations || [])
      .filter((v) => v.rule.startsWith('doc-coverage') && v.severity !== 'advisory');
    assert.equal(local.ok, expectOk, `local doc-coverage verdict mismatch for ${expectOk}`);
    assert.equal(ciDocBlocking.length === 0, expectOk, 'CI doc-coverage verdict diverged from local');
  }
});

// ---- Unit: validator selection + handoff detection ----
test('selectPreflightValidators adds doc-coverage only when a COLLABORATOR_HANDOFF is posted', () => {
  const without = preflight.selectPreflightValidators(false, false, false);
  assert.deepEqual(without.validators, ['manager-handoff']);
  const withHandoff = preflight.selectPreflightValidators(false, false, true);
  assert.ok(withHandoff.validators.includes('doc-coverage'));
  assert.ok(withHandoff.validators.includes('manager-handoff'));
});

test('hasCollaboratorHandoff matches the artifact header, not a prose mention', () => {
  assert.equal(preflight.hasCollaboratorHandoff([{ body: '## COLLABORATOR_HANDOFF\nx' }]), true);
  assert.equal(preflight.hasCollaboratorHandoff([{ body: 'COLLABORATOR_HANDOFF\nx' }]), true);
  // A MANAGER_HANDOFF that names the artifact in prose must NOT count.
  assert.equal(preflight.hasCollaboratorHandoff([
    { body: 'MANAGER_HANDOFF\nscope: post the COLLABORATOR_HANDOFF after impl' },
  ]), false);
  assert.equal(preflight.hasCollaboratorHandoff([]), false);
});
