// #3331 regression: the canonical baton-artifact builder must be ABLE to emit the
// worktree/verification fields its own megalint validators require, so a
// builder-produced artifact passes those validators with NO manual field
// additions. Before this fix, baton-artifact-schema.js omitted the fields and the
// builder's assertValid() threw `unknown field` on any attempt to supply them.
// This spec asserts builder output models the validator (AC2) for MANAGER /
// COLLABORATOR / CONSULTANT on lane:code-change.
const { test, expect } = require('@playwright/test');
const { buildArtifact } = require('../scripts/global/baton-artifact-builder');
const wtGate = require('../scripts/global/worktree-lifecycle-gate');
const { checkHandoffHasVerification } = require('../scripts/global/collaborator-self-check');
const managerMega = require('../scripts/global/megalint/manager-handoff');

const TM = 'claude-code:opus@local';
const BRANCH = 'fix/3331-baton-builder-worktree-fields';
const CLEAN_SUMMARY = { counts: { 'stale-safe': 0, 'stale-risky': 0, 'detached-temp': 0, 'rescue-needed': 0 }, total: 0 };

test('builder MANAGER_HANDOFF carries worktree_branch and clears wtGate.checkManager', () => {
  const out = buildArtifact({
    artifact: 'MANAGER_HANDOFF', role: 'manager', teamModel: TM, ticket: '3331',
    fields: {
      scope: 'add worktree fields', lane: 'lane:code-change', test_strategy: 'tdd-pyramid',
      acceptance: '- AC1', gates: 'lint, test', related_tickets: '#3328', overlap_decision: 'no-overlap',
      worktree_branch: BRANCH,
    },
  });
  expect(out).toContain(`worktree_branch: ${BRANCH}`);
  expect(wtGate.checkManager(out, { lane: 'lane:code-change', branch: BRANCH, ticketRef: 3331 })).toEqual([]);
  // Full megalint manager validator (clean of doc-coverage deps) is also satisfied.
  const r = managerMega.validate({ comments: [{ body: out }], lane: 'lane:code-change', branch: BRANCH, ticketRef: 3331, issueNumber: 3331 });
  expect(r.ok).toBe(true);
});

test('builder COLLABORATOR_HANDOFF carries worktree fields + self-check block and clears both gates', () => {
  const out = buildArtifact({
    artifact: 'COLLABORATOR_HANDOFF', role: 'collaborator', teamModel: TM, ticket: '3331',
    fields: {
      scope: 'impl', test_strategy: 'tdd-pyramid', per_ac_verification: '- AC1 PASS',
      cross_family_rating: '9/10', cross_family_reviewer: 'qwen2.5-coder:32b@fleet', cross_family_findings: 'none',
      worktree_branch: BRANCH, worktree_behind_main: '0',
      'Pre-handoff verification': '(PASS)\n- [x] `branch-name-prefix` — pass',
    },
  });
  expect(out).toContain(`worktree_branch: ${BRANCH}`);
  expect(out).toContain('worktree_behind_main: 0');
  expect(out).toContain('Pre-handoff verification');
  expect(wtGate.checkCollaborator(out, { lane: 'lane:code-change', branch: BRANCH })).toEqual([]);
  expect(checkHandoffHasVerification(out).ok).toBe(true);
});

test('builder CONSULTANT_CLOSEOUT carries worktree_residual_risk and clears wtGate.checkConsultant', () => {
  const out = buildArtifact({
    artifact: 'CONSULTANT_CLOSEOUT', role: 'consultant', teamModel: TM, ticket: '3331',
    fields: {
      status: 'review', verdict: 'approve_for_merge', 'verification-timestamp': '2026-06-29T00:00:00Z',
      rubric_rating: '9/10', anneal_tickets_filed: 'none', mid_flight_flaws: 'none',
      worktree_residual_risk: 'none',
    },
  });
  expect(out).toContain('worktree_residual_risk: none');
  expect(wtGate.checkConsultant(out, { lane: 'lane:code-change', worktreeSummary: CLEAN_SUMMARY })).toEqual([]);
});

test('worktree fields are accepted by the builder (no unknown-field throw) yet remain optional', () => {
  // Optional: an artifact omitting them still builds (back-compat / non-code-change lanes).
  expect(() => buildArtifact({
    artifact: 'MANAGER_HANDOFF', role: 'manager', teamModel: TM,
    fields: { scope: 's', lane: 'lane:config-only', test_strategy: 'manual-verify', acceptance: '-', gates: 'g', related_tickets: '#1', overlap_decision: 'no-overlap' },
  })).not.toThrow();
  // Present: supplying the field no longer throws unknown-field.
  expect(() => buildArtifact({
    artifact: 'CONSULTANT_CLOSEOUT', role: 'consultant', teamModel: TM,
    fields: { status: 'review', verdict: 'approve_for_merge', 'verification-timestamp': 't', rubric_rating: '9/10', anneal_tickets_filed: 'none', mid_flight_flaws: 'none', worktree_residual_risk: 'none' },
  })).not.toThrow();
});
