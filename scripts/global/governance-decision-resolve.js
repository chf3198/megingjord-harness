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

/**
 * Resolve the check-set NAME + ordered ids for (transition, lane). lane_overrides are
 * keyed `lane:<name>`; context.lane is the bare name. Fail-closed on unknown transition/set.
 * @param {object} policy - The governance decision policy.
 * @param {string} transition - Baton transition key.
 * @param {string} lane - Bare lane name (e.g. 'code-change').
 * @returns {object} {name, ids[]} or {error, ...} on failure.
 */
function resolveCheckSet(policy, transition, lane) {
  const trans = policy && policy.transitions && policy.transitions[transition];
  if (!trans) return { error: 'unknown-transition', transition };
  const name = (trans.lane_overrides && trans.lane_overrides[`lane:${lane}`]) || trans.default_check_set;
  const ids = policy.check_sets && policy.check_sets[name];
  if (!Array.isArray(ids)) return { error: 'unknown-check-set', name };
  return { name, ids: ids.slice() };
}

/**
 * Apply a runtime profile to ordered check ids. all_checks_blocking (ci) overrides the
 * advisory_after downgrade; skip removes a check from execution.
 * @param {string[]} ids - Ordered check ids from the resolved set.
 * @param {object} [profile] - {skip[], advisory_after[], all_checks_blocking}.
 * @returns {Array<{id:string, blocking:boolean, skipped:boolean}>} Per-check execution plan.
 */
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

/**
 * Normalize a raw input value to {status,reason,evidence_ref}, or null if unrecognized.
 * Accepts boolean, a bare status string, or a {status,reason,evidence_ref} object.
 * @param {*} value - Raw per-check input from context.inputs.
 * @returns {?object} {status,reason,evidence_ref} or null when unrecognized.
 */
function normStatus(value) {
  if (typeof value === 'boolean') return { status: value ? 'pass' : 'fail', reason: null, evidence_ref: null };
  if (typeof value === 'string' && STATUSES.has(value)) return { status: value, reason: null, evidence_ref: null };
  if (value && typeof value === 'object' && STATUSES.has(value.status)) {
    return { status: value.status, reason: value.reason || null, evidence_ref: value.evidence_ref || null };
  }
  return null;
}

/**
 * Default fail-closed check: read context.inputs[id]. Missing/garbage => fail (consensus Q1=B).
 * @param {object} context - The evaluation context (uses context.inputs).
 * @param {string} id - The check id to resolve.
 * @returns {{id:string, status:string, reason:?string, evidence_ref:?string}} CheckResult.
 */
function defaultCheck(context, id) {
  const raw = context && context.inputs ? context.inputs[id] : undefined;
  if (raw === undefined) return { id, status: 'fail', reason: 'missing-input', evidence_ref: null };
  const norm = normStatus(raw);
  return norm ? { id, ...norm } : { id, status: 'fail', reason: 'unrecognized-input', evidence_ref: null };
}

module.exports = { TRANSITIONS, STATUSES, resolveCheckSet, applyProfile, defaultCheck };
