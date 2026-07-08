'use strict';
// baton-e2e-harness — reusable driver for the full-baton end-to-end fixture (#2064).
//
// Design (cross-model panel consensus 2026-07-01, #2064): the cycle is exercised
// against a SIMULATED in-memory ticket (a comments+labels array), never a live
// GitHub issue — keeping the surface zero-cost (G3), portable (G5), and
// deterministic in CI (G6). Real-network side-effects (PR create/merge, atomic
// close) are modelled as FSM state+evidence transitions; that boundary is
// documented in the spec header.
//
// Two layers are stitched here so no single existing test covers them together:
//   (1) builder -> megalint validator  (each artifact is schema-built then validated)
//   (2) canonical baton FSM            (label/state transitions triage..done)

const { buildArtifact } = require('../../scripts/global/baton-artifact-builder');
const managerValidator = require('../../scripts/global/megalint/manager-handoff');
const collaboratorValidator = require('../../scripts/global/megalint/collaborator-handoff');
const adminValidator = require('../../scripts/global/megalint/admin-handoff');
const consultantValidator = require('../../scripts/global/megalint/consultant-closeout');
const signerFidelity = require('../../scripts/global/megalint/signer-fidelity');
const fsm = require('../../scripts/global/baton-fsm');
const { createEvidence } = require('../../scripts/global/baton-fsm/provenance');
const { EVIDENCE_BITS: BITS, STATES, EVENTS, findTransition } = require('../../scripts/global/baton-fsm/transitions');

// A simulated ticket whose branch is deliberately NOT on the live worktree board,
// so the worktree-lifecycle gate stays deterministic regardless of session state.
const SIM_TICKET = '000000';
const SIM_BRANCH = 'feat/000000-baton-e2e-sim';
const TEAM = 'claude-code:opus@local';
// No area:* label → doc-coverage matrix maps to zero required surfaces (clean).
const SIM_LABELS = ['type:task', 'lane:code-change'];

// ---- Layer 1: build every baton artifact from structured fields --------------

function buildManagerHandoff() {
  return buildArtifact({ artifact: 'MANAGER_HANDOFF', role: 'manager', teamModel: TEAM, fields: {
    scope: 'Simulated full-baton e2e cycle', lane: 'lane:code-change',
    test_strategy: 'tdd-pyramid+stress-test', acceptance: 'AC1..AC5 verified in-memory',
    gates: 'node --test green; baton gates clean', related_tickets: '#1944',
    overlap_decision: 'non-redundant simulated fixture', worktree_branch: SIM_BRANCH,
    flaws_recognized: 'none' } });
}

function buildCollaboratorHandoff() {
  return buildArtifact({ artifact: 'COLLABORATOR_HANDOFF', role: 'collaborator', teamModel: TEAM, ticket: SIM_TICKET, fields: {
    scope: 'Implement simulated cycle', test_strategy: 'tdd-pyramid+stress-test',
    per_ac_verification: 'AC1 PASS; AC2 PASS; AC3 PASS; AC4 PASS; AC5 PASS',
    doc_coverage: 'N/A: no area-mapped surface — in-memory test fixture',
    cross_family_rating: '9/10', cross_family_reviewer: 'qwen2.5-coder:32b@ollama',
    cross_family_findings: 'no blocking findings', cross_family_receipt: '0123456789abcdef',
    reviewer_family: 'qwen', worktree_branch: SIM_BRANCH, worktree_behind_main: '0',
    'Pre-handoff verification': 'node --test green; lint clean', flaws_recognized: 'none' } });
}

function buildAdminHandoff() {
  const body = buildArtifact({ artifact: 'ADMIN_HANDOFF', role: 'admin', teamModel: TEAM, ticket: SIM_TICKET, fields: {
    branch: SIM_BRANCH, commit: 'abc1234', 'signer-independence-check': 'PASS',
    'deploy-runtime-impact': 'none — simulated', flaws_recognized: 'none' } });
  // Determinism: wtGate.checkAdmin scans the LIVE worktree board via plan() unless a
  // worktree_cleanup: line is present (the gate's own advisory recommends adding one).
  // The builder schema cannot emit this field today (see #2064 closeout flaws_recognized),
  // so a real compliant Admin adds it by hand — we mirror that here to stay board-decoupled.
  // #3672: same reason the receipt is appended (not a builder field) — this single-team
  // (claude-code) baton proves independence via a cross-family receipt cited on the ADMIN
  // handoff; the posting-time megalint has no issue context to ledger-verify it (advisory
  // there), the CI consensus-receipt-check + merge gate do the blocking verification.
  return body + '\nworktree_cleanup: none — simulated ticket, no board entry'
    + '\ncross_family_receipt: 0123456789abcdef';
}

function buildConsultantCloseout() {
  return buildArtifact({ artifact: 'CONSULTANT_CLOSEOUT', role: 'consultant', teamModel: TEAM, ticket: SIM_TICKET, fields: {
    status: 'review', verdict: 'approve_for_merge', 'verification-timestamp': '2026-07-01T00:00:00Z',
    rubric_rating: '9/10 — G1=9 G2=9 G3=9 G4=9 G5=9 G6=9 G7=9 G8=9 G9=9',
    anneal_tickets_filed: 'none', mid_flight_flaws: 'none', worktree_residual_risk: 'none',
    flaws_recognized: 'none' } });
}

function buildAllArtifacts() {
  return {
    manager: buildManagerHandoff(), collaborator: buildCollaboratorHandoff(),
    admin: buildAdminHandoff(), consultant: buildConsultantCloseout(),
  };
}

// Run each artifact through its megalint validator with injected, deterministic
// inputs. Returns { role: {ok, violations} } for every gate.
function runValidators(artifacts) {
  const comments = [
    { body: artifacts.manager }, { body: artifacts.collaborator },
    { body: artifacts.admin }, { body: artifacts.consultant },
  ];
  const base = { comments, labels: SIM_LABELS, lane: 'lane:code-change' };
  const zeroWorktree = { counts: { 'stale-risky': 0, 'rescue-needed': 0 } };
  return {
    manager: managerValidator.validate({ ...base }),
    collaborator: collaboratorValidator.validate({ ...base, prFiles: [] }),
    admin: adminValidator.validate({ ...base }),
    consultant: consultantValidator.validate({ ...base, isEpic: false, worktreeSummary: zeroWorktree }),
    signerManager: signerFidelity.validate({ body: artifacts.manager }),
    signerCollaborator: signerFidelity.validate({ body: artifacts.collaborator }),
    signerAdmin: signerFidelity.validate({ body: artifacts.admin }),
    signerConsultant: signerFidelity.validate({ body: artifacts.consultant }),
  };
}

// ---- Layer 2: drive the canonical baton FSM through the full happy path ------

async function evidenceFor(mask) {
  return createEvidence({ mask });
}

// The full baton walk: each step accumulates the evidence bits earned so far, so
// every transition sees a superset of its requiredMask (as a live board would).
function happyPathSteps() {
  const managerBits = BITS.MANAGER_HANDOFF;
  const collabBits = managerBits | BITS.COLLABORATOR_HANDOFF | BITS.ALL_ACS_PASS;
  const adminBits = collabBits | BITS.ADMIN_HANDOFF | BITS.SIGNER_INDEPENDENT | BITS.CI_GREEN | BITS.WORKTREE_MERGE_OK;
  const mergedBits = adminBits | BITS.PR_MERGED;
  const closeoutBits = mergedBits | BITS.CONSULTANT_CLOSEOUT;
  return [
    { from: 'backlog', event: 'pickup_manager', to: 'triage', mask: 0 },
    { from: 'triage', event: 'manager_handoff', to: 'ready', mask: managerBits },
    { from: 'ready', event: 'pickup_collaborator', to: 'in-progress', mask: managerBits },
    { from: 'in-progress', event: 'collaborator_handoff', to: 'testing', mask: collabBits },
    { from: 'testing', event: 'merge', to: 'testing', mask: adminBits },
    { from: 'testing', event: 'admin_handoff', to: 'review', mask: adminBits },
    { from: 'review', event: 'consultant_closeout', to: 'done', mask: closeoutBits },
  ];
}

// Resolve the canonical target state the FSM transition table maps (from,event) to,
// so the happy-path test can assert the walk LANDS where each step claims — not merely
// that the transition was 'allowed' (cross-family review #2064, Cerebras finding #2).
function canonicalTargetState(step) {
  const fromCode = STATES[step.from.toUpperCase().replace(/-/g, '_')];
  const eventCode = EVENTS[step.event.toUpperCase()];
  const row = findTransition(fromCode, eventCode);
  if (!row) return null;
  const name = Object.keys(STATES).find((key) => STATES[key] === row.toState);
  return name ? name.toLowerCase().replace(/_/g, '-') : null;
}

async function driveHappyPath() {
  const verdicts = [];
  for (const step of happyPathSteps()) {
    const evidence = await evidenceFor(step.mask);
    const verdict = await fsm.evaluate(step.from, step.event, evidence);
    verdicts.push({ step, verdict });
  }
  return verdicts;
}

module.exports = {
  SIM_TICKET, SIM_BRANCH, SIM_LABELS, TEAM, BITS,
  buildAllArtifacts, buildManagerHandoff, buildCollaboratorHandoff,
  buildAdminHandoff, buildConsultantCloseout,
  runValidators, evidenceFor, happyPathSteps, driveHappyPath, canonicalTargetState, fsm,
};
