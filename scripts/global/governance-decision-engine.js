'use strict';
// governance-decision-engine.js (#2483) — PURE (no IO, no subprocess) policy-driven
// evaluator that deterministically gates each baton role transition, replacing
// discretionary per-validator gating. `evaluate(context, opts) -> Decision`.
// Shadow-mode: MEGINGJORD_DECISION_ENGINE gates whether the HARNESS acts on the
// decision; evaluate() itself is always callable and writes nothing. Fail-closed on
// malformed policy (AC1). Design: research/governance-decision-engine-design-2026-05-30.md.

const fs = require('node:fs');
const path = require('node:path');
const { resolveCheckSet, applyProfile, defaultCheck } = require('./governance-decision-resolve');

const POLICY_PATH = path.join(__dirname, '..', '..', 'config', 'governance-decision-policy.json');

/**
 * Load + validate the policy. Absent/malformed/wrong-version throws (fail-closed).
 * @param {string} [file] - Path to the policy JSON (defaults to POLICY_PATH).
 * @returns {object} The validated policy body (version pinned to 1).
 */
function loadPolicy(file = POLICY_PATH) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { throw new Error(`decision-policy unreadable: ${e.message}`); }
  if (raw.version !== undefined && raw.version !== 1) throw new Error('decision-policy version must be 1');
  const policyBody = raw.default_policy || raw;
  if (!policyBody.transitions || !policyBody.check_sets || !policyBody.runtime_profiles) {
    throw new Error('decision-policy missing required sections');
  }
  policyBody.version = 1;
  return policyBody;
}

/**
 * Run one check-plan step: skip, or resolve via registry/default, recording degradations.
 * @param {object} step - {id, blocking, skipped} from applyProfile.
 * @param {object} ctx - The evaluation context.
 * @param {object} registry - Optional {id:(ctx)=>CheckResult} overrides.
 * @param {Array} degradations - Mutable list the profile effects are pushed to.
 * @returns {object} The CheckResult augmented with {id, blocking}.
 */
function runStep(step, ctx, registry, degradations) {
  if (step.skipped) {
    degradations.push({ reason: `skip:${step.id}`, applied_by_profile: ctx.runtime_profile });
    return { id: step.id, status: 'skip', reason: 'profile-skip', evidence_ref: null, blocking: false };
  }
  const fn = registry[step.id];
  const checkResult = fn ? fn(ctx) : defaultCheck(ctx, step.id);
  // Record an advisory degradation only when it MATTERS: a failing check the profile
  // downgraded so it did not block (cross-family review, Mistral #2, 2026-07-13).
  if (!step.blocking && checkResult.status === 'fail') {
    degradations.push({ reason: `advisory:${step.id}`, applied_by_profile: ctx.runtime_profile });
  }
  return { ...checkResult, id: step.id, blocking: step.blocking };
}

/**
 * Whether the harness should ACT on the engine's decision (shadow-mode flag).
 * @param {object} [env] - Environment map (defaults to process.env).
 * @returns {boolean} True when MEGINGJORD_DECISION_ENGINE === '1'.
 */
function isEnabled(env = process.env) { return env.MEGINGJORD_DECISION_ENGINE === '1'; }

/**
 * Build a fail-closed block Decision for a resolution error (unknown transition/set).
 * @param {string} reason - Machine-readable error reason.
 * @param {object} ctx - The evaluation context.
 * @param {string} now - ISO timestamp for the audit trace.
 * @returns {object} A block Decision carrying the error in audit_trace.
 */
function blockDecision(reason, ctx, now) {
  return {
    decision: 'block', checks: [], degradations: [{ reason, applied_by_profile: null }],
    audit_trace: {
      policy_version: 1, resolved_check_set: null, transition: ctx.transition,
      lane: ctx.lane, runtime_profile: ctx.runtime_profile, timestamp: now, error: reason,
    },
  };
}

/**
 * Evaluate a baton transition against the policy. Aggregation (consensus Q2=A):
 * block if any BLOCKING check fails; else advisory if any advisory check fails; else allow.
 * @param {object} context - {transition, lane, runtime_profile, ticket, inputs}.
 * @param {object} [opts] - {policy, policyPath, checks:{id:(ctx)=>CheckResult}, now}.
 * @returns {object} Decision {decision, checks[], degradations[], audit_trace}.
 */
function evaluate(context, opts = {}) {
  const now = opts.now || new Date().toISOString();
  const ctx = context || {};
  const policy = opts.policy || loadPolicy(opts.policyPath);
  const registry = opts.checks || {};
  const resolved = resolveCheckSet(policy, ctx.transition, ctx.lane);
  if (resolved.error) return blockDecision(resolved.error, ctx, now);
  const profile = policy.runtime_profiles[ctx.runtime_profile] || {};
  const degradations = [];
  const checks = applyProfile(resolved.ids, profile)
    .map((step) => runStep(step, ctx, registry, degradations));
  const blockingFail = checks.some((c) => c.blocking && c.status === 'fail');
  const advisoryFail = checks.some((c) => !c.blocking && c.status === 'fail');
  const decision = blockingFail ? 'block' : advisoryFail ? 'advisory' : 'allow';
  return {
    decision, checks, degradations,
    audit_trace: {
      policy_version: policy.version, resolved_check_set: resolved.name,
      transition: ctx.transition, lane: ctx.lane, runtime_profile: ctx.runtime_profile, timestamp: now,
    },
  };
}

module.exports = { evaluate, loadPolicy, isEnabled, POLICY_PATH };
