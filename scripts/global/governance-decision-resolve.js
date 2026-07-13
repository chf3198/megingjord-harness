'use strict';
// governance-decision-resolve.js (#2483) — pure helpers for the decision engine:
// per-transition x per-lane check-set resolution, runtime-profile application
// (skip / advisory_after / all_checks_blocking), and the default fail-closed check
// resolver. Design: research/governance-decision-engine-design-2026-05-30.md.
// Cross-model consensus (2026-07-13, meta+mistral, 2 families): missing input =>
// fail-closed; advisory_after downgrades checks positioned AFTER the named boundary.

const TRANSITIONS = Object.freeze([
  'manager_to_collaborator', 'collaborator_to_admin', 'admin_to_consultant', 'consultant_to_done',
]);
const STATUSES = new Set(['pass', 'fail', 'skip']);

// Resolve the check-set NAME + ordered ids for (transition, lane). lane_overrides are
// keyed `lane:<name>`; context.lane is the bare name. Fail-closed on unknown transition/set.
function resolveCheckSet(policy, transition, lane) {
  const t = policy && policy.transitions && policy.transitions[transition];
  if (!t) return { error: 'unknown-transition', transition };
  const name = (t.lane_overrides && t.lane_overrides[`lane:${lane}`]) || t.default_check_set;
  const ids = policy.check_sets && policy.check_sets[name];
  if (!Array.isArray(ids)) return { error: 'unknown-check-set', name };
  return { name, ids: ids.slice() };
}

// Ordered ids + runtime profile => [{id, blocking, skipped}]. all_checks_blocking (ci)
// overrides the advisory_after downgrade; skip removes a check from execution.
function applyProfile(ids, profile = {}) {
  const skip = new Set(profile.skip || []);
  const boundaries = (profile.advisory_after || []).map((b) => ids.indexOf(b)).filter((i) => i >= 0);
  const boundaryIdx = boundaries.length ? Math.min(...boundaries) : -1;
  return ids.map((id, i) => {
    if (skip.has(id)) return { id, skipped: true, blocking: false };
    const downgraded = !profile.all_checks_blocking && boundaryIdx >= 0 && i > boundaryIdx;
    return { id, skipped: false, blocking: !downgraded };
  });
}

// Normalize a raw input value to {status,reason,evidence_ref}, or null if unrecognized.
// Accepts boolean, a bare status string, or a {status,reason,evidence_ref} object.
function normStatus(v) {
  if (typeof v === 'boolean') return { status: v ? 'pass' : 'fail', reason: null, evidence_ref: null };
  if (typeof v === 'string' && STATUSES.has(v)) return { status: v, reason: null, evidence_ref: null };
  if (v && typeof v === 'object' && STATUSES.has(v.status)) {
    return { status: v.status, reason: v.reason || null, evidence_ref: v.evidence_ref || null };
  }
  return null;
}

// Default fail-closed check: read context.inputs[id]. Missing/garbage => fail (consensus Q1=B).
function defaultCheck(context, id) {
  const v = context && context.inputs ? context.inputs[id] : undefined;
  if (v === undefined) return { id, status: 'fail', reason: 'missing-input', evidence_ref: null };
  const norm = normStatus(v);
  return norm ? { id, ...norm } : { id, status: 'fail', reason: 'unrecognized-input', evidence_ref: null };
}

module.exports = { TRANSITIONS, STATUSES, resolveCheckSet, applyProfile, defaultCheck };
