#!/usr/bin/env node
'use strict';

// Declarative field specs for the six baton COMMENT artifacts (Epic #2037 P1.1,
// Refs #2671). Each artifact lists its fields in canonical render order. The
// builder (baton-artifact-builder.js) renders structure + signing deterministically;
// the LLM supplies only field values, and only `block` fields are free-text slots.
//
// Field shape: { k: <key>, req: <required?>, block: <multiline narrative slot?> }

function f(k, opts = {}) {
  return { k, req: !!opts.req, block: !!opts.block };
}

// MANAGER_HANDOFF — scope + lane + strategy + gates + overlap-handoff declaration
// (related_tickets + overlap_decision are required by the #2617 overlap gate);
// phase-gate fields optional.
const MANAGER = [
  f('scope', { req: true }),
  f('lane', { req: true }),
  f('test_strategy', { req: true }),
  f('acceptance', { req: true, block: true }),
  f('gates', { req: true }),
  f('related_tickets', { req: true }),
  f('overlap_decision', { req: true }),
  // #3331: worktree-lifecycle-gate.checkManager requires worktree_branch on
  // lane:code-change. OPTIONAL here (the gate skips other lanes; the historical
  // replay corpus predates it), but ALLOWED so the builder can emit a CI-valid
  // artifact unaided instead of throwing on the unknown key.
  f('worktree_branch'),
  f('anneal_tier'),
  f('phase_gate_satisfied'),
  f('phase_0_sources'),
  f('goal_lens'),
];

// COLLABORATOR_HANDOFF — per-AC verification narrative + cross-family preflight.
const COLLABORATOR = [
  f('scope', { req: true }),
  f('test_strategy', { req: true }),
  f('per_ac_verification', { req: true, block: true }),
  f('doc_coverage', { block: true }),
  f('cross_family_rating', { req: true }),
  f('cross_family_reviewer', { req: true }),
  f('cross_family_findings', { req: true }),
  // #3016: the canonical builder must be ABLE to emit cross_family_receipt (#2904) so a
  // gate-conforming handoff is possible — but keep it OPTIONAL here so the historical
  // replay-eval corpus (artifacts predating the receipt) still builds. Runtime enforcement
  // lives in collaborator-handoff.checkCrossFamily, which hard-requires it on live PRs.
  f('cross_family_receipt', {}),
  f('reviewer_family', {}),
  // #3331: worktree-lifecycle-gate.checkCollaborator + collaborator-self-check
  // require these on lane:code-change. OPTIONAL (lane-gated + corpus back-compat),
  // but ALLOWED so a builder-produced handoff passes the validators unaided. The
  // verification key is the literal phrase the self-check scans for, so the block
  // is detected structurally regardless of the pasted formatChecks() value.
  f('worktree_branch'),
  f('worktree_behind_main'),
  f('Pre-handoff verification', { block: true }),
];

// ADMIN_HANDOFF — branch/commit + signer-independence + deploy-sync impact.
const ADMIN = [
  f('branch', { req: true }),
  f('commit', { req: true }),
  f('signer-independence-check', { req: true }),
  f('deploy-runtime-impact', { req: true }),
];

// CONSULTANT_CLOSEOUT — verdict + rubric + anneal/flaw accounting.
const CONSULTANT = [
  f('status', { req: true }),
  f('verdict', { req: true }),
  f('verification-timestamp', { req: true }),
  f('rubric_rating', { req: true }),
  f('anneal_tickets_filed', { req: true }),
  f('mid_flight_flaws', { req: true, block: true }),
  // #3331: worktree-lifecycle-gate.checkConsultant requires worktree_residual_risk
  // (none | <details>) on non-lightweight lanes. OPTIONAL for back-compat; ALLOWED
  // so the builder can emit it unaided.
  f('worktree_residual_risk'),
];

// EPIC_RESCOPE — single narrative synthesis slot (irreducible per #2038).
const EPIC_RESCOPE = [f('summary', { req: true, block: true })];

// BLOCKER_NOTE — ready-SLA escalation contract fields.
const BLOCKER = [
  f('BLOCKER_NOTE', { req: true }),
  f('owner', { req: true }),
  f('unblock_condition', { req: true }),
  f('eta_or_review_time', { req: true }),
];

// `ticket: #N` line is rendered (after header) only where the artifact carries it.
const ARTIFACT_SPECS = {
  MANAGER_HANDOFF: { fields: MANAGER, ticket: false },
  COLLABORATOR_HANDOFF: { fields: COLLABORATOR, ticket: true },
  ADMIN_HANDOFF: { fields: ADMIN, ticket: true },
  CONSULTANT_CLOSEOUT: { fields: CONSULTANT, ticket: true },
  EPIC_RESCOPE: { fields: EPIC_RESCOPE, ticket: false },
  BLOCKER_NOTE: { fields: BLOCKER, ticket: true },
};

module.exports = { ARTIFACT_SPECS, f };
