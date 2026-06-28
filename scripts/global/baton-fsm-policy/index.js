// index.js — Public API for the baton-fsm-policy module.
// Default path uses the pure-JS policy-substrate (zero infra, AC3).
// opts.sidecar:true opts into OPA sidecar when available,
// falling back to JS with an advisory if absent. Refs #3286, Epic #3284.
'use strict';

const { evaluatePolicy, POLICY_VERSION } = require('./policy-substrate');
const {
  evaluateViaOpa,
  sidecarParity,
  opaAvailable,
  OPA_ABSENT_REASON,
} = require('./opa-sidecar');
const { STATES, EVENTS } = require('../baton-fsm/transitions');

/** Opt-in constant documenting the sidecar mode. */
const OPT_IN_SIDECAR = 'Set opts.sidecar = true to enable OPA sidecar evaluation. '
  + 'Requires the opa binary on PATH. Falls back to pure-JS with advisory when absent.';

/**
 * Resolve a string state/event name to its numeric code,
 * or pass through a numeric code unchanged.
 */
function resolveCode(nameOrCode, enumObj) {
  if (typeof nameOrCode === 'number') return nameOrCode;
  if (typeof nameOrCode !== 'string') return undefined;
  const key = nameOrCode.toUpperCase().replace(/-/g, '_');
  return enumObj[key];
}

/** Build a deny result for invalid input. */
function buildInvalidInputResult(state, event) {
  return {
    decision: 'deny',
    reason: 'invalid-input',
    required_next: 'none',
    policy_version: POLICY_VERSION,
    decision_log: [{
      rule_id: 'input-validation',
      input: { state, event },
      matched: true,
      verdict: 'deny: unrecognized state or event',
    }],
  };
}

/** Annotate a JS result with sidecar metadata. */
function annotateSidecar(jsResult, options) {
  if (!options.sidecar) {
    jsResult.engine = 'js-policy-substrate';
    return jsResult;
  }
  if (!opaAvailable()) {
    jsResult.engine = 'js-policy-substrate';
    jsResult.sidecar_advisory = OPA_ABSENT_REASON
      + ': falling back to pure-JS policy substrate';
    return jsResult;
  }
  jsResult.engine = 'js-policy-substrate+opa-sidecar';
  return jsResult;
}

/**
 * Evaluate a baton policy transition.
 * Default uses pure-JS policy-substrate (AC3, zero infra).
 * opts.sidecar === true enables OPA sidecar when available.
 */
function evaluate(state, event, evidence, opts) {
  const options = opts || {};
  const stateCode = resolveCode(state, STATES);
  const eventCode = resolveCode(event, EVENTS);
  if (stateCode === undefined || eventCode === undefined) {
    return buildInvalidInputResult(state, event);
  }
  const evidenceMask = typeof evidence === 'number' ? evidence : 0;
  const jsResult = evaluatePolicy(stateCode, eventCode, evidenceMask);
  return annotateSidecar(jsResult, options);
}

module.exports = {
  evaluate,
  evaluatePolicy,
  evaluateViaOpa,
  sidecarParity,
  opaAvailable,
  OPT_IN_SIDECAR,
  POLICY_VERSION,
};
