// index.js — Host layer + public API for the baton FSM.
// evaluate(state, event, evidence) -> signedVerdict. Refs #3287, Epic #3284.
'use strict';

const { STATES, EVENTS, EVIDENCE_BITS, DECISIONS, STATE_NAMES, EVENT_NAMES } = require('./transitions');
const kernelJs = require('./kernel');
const { canonicalize, GRAMMAR_VERSION } = require('./grammar');
const { verifyEvidence, computeFactsHash } = require('./provenance');

const FSM_VERSION = '1.0.0';

let batonSigning = null;
try {
  batonSigning = require('../baton-signing');
} catch {
  // baton-signing unavailable; use unsigned verdicts
}

/**
 * Load and validate the WASM kernel, returning its decide function.
 * @returns {Promise<Function>} The WASM decide(state, event, evidence) function.
 */
async function loadWasmKernel() {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const wasmPath = join(__dirname, 'kernel.wasm');
  const wasmBytes = readFileSync(wasmPath);
  const wasmModule = await WebAssembly.instantiate(wasmBytes, {});
  return wasmModule.instance.exports.decide;
}

/**
 * Resolve state and event name strings to numeric codes.
 * @returns {{stateCode: number, eventCode: number} | null} Null if invalid.
 */
function resolveStateCodes(state, event) {
  const stateKey = state.toUpperCase().replace(/-/g, '_');
  const eventKey = event.toUpperCase();
  const stateCode = STATES[stateKey];
  const eventCode = EVENTS[eventKey];
  if (stateCode === undefined || eventCode === undefined) return null;
  return { stateCode, eventCode };
}

/**
 * Compute the evidence bitmask from grammar output or pre-computed facts.
 * @returns {{ok: boolean, mask?: number, reason?: string}}
 */
function computeEvidenceMask(options, evidence) {
  if (options.artifactText) {
    const grammarResult = canonicalize(options.artifactText);
    if (!grammarResult.ok) return { ok: false, reason: grammarResult.reason };
    return { ok: true, mask: grammarResult.mask };
  }
  if (evidence.facts && typeof evidence.facts.mask === 'number') {
    return { ok: true, mask: evidence.facts.mask };
  }
  return { ok: true, mask: 0 };
}

/**
 * Execute the kernel (JS reference or WASM) and return the packed result.
 * @returns {Promise<{packed: number, parityError?: string}>}
 */
async function executeKernel(stateCode, eventCode, evidenceMask, options) {
  if (!options.useWasm) {
    return { packed: kernelJs.decide(stateCode, eventCode, evidenceMask) };
  }
  const wasmDecide = await loadWasmKernel();
  const wasmResult = wasmDecide(stateCode, eventCode, evidenceMask);
  const jsResult = kernelJs.decide(stateCode, eventCode, evidenceMask);
  if (wasmResult !== jsResult) {
    return { packed: jsResult, parityError: 'wasm=' + wasmResult + ' js=' + jsResult };
  }
  return { packed: wasmResult };
}

/**
 * Attach an Ed25519 signature to a verdict object (mutates in place).
 */
async function signVerdict(verdict) {
  if (!batonSigning) return;
  const signed = await batonSigning.sign(JSON.stringify(verdict));
  verdict.signature = signed.signature;
  verdict.signer_key_id = signed.key_id;
  verdict.signed_at = signed.timestamp;
}

/**
 * Build a rejection verdict for pre-kernel denied requests.
 */
async function buildRejection(decision, reason, state, event, evidence) {
  const verdict = {
    decision: 'deny', reason, required_next: 'none',
    fsm_version: FSM_VERSION, grammar_version: GRAMMAR_VERSION,
    state, event,
    evidence_hash: evidence ? evidence.evidence_hash : 'none',
    rejection_source: decision,
  };
  await signVerdict(verdict);
  return verdict;
}

/**
 * Evaluate a baton transition request.
 *
 * Steps:
 *   (a) verifyEvidence provenance - reject forged
 *   (b) resolve state/event codes
 *   (c) compute evidenceMask (grammar or pre-computed)
 *   (d) call the kernel (JS ref by default; WASM optional)
 *   (e) build + sign verdict object
 *
 * @param {string} state - Current state name (e.g., 'triage').
 * @param {string} event - Event name (e.g., 'manager_handoff').
 * @param {object} evidence - Signed evidence envelope from provenance.createEvidence().
 * @param {object} [options] - Options: {useWasm: boolean, artifactText: string}.
 * @returns {Promise<object>} Signed verdict.
 */
async function evaluate(state, event, evidence, options = {}) {
  const provenanceResult = verifyEvidence(evidence);
  if (!provenanceResult.valid) {
    return buildRejection('provenance-invalid', provenanceResult.reason, state, event, evidence);
  }
  const codes = resolveStateCodes(state, event);
  if (!codes) {
    const reason = STATES[state.toUpperCase().replace(/-/g, '_')] === undefined
      ? 'unknown state: ' + state : 'unknown event: ' + event;
    return buildRejection('invalid-input', reason, state, event, evidence);
  }
  const maskResult = computeEvidenceMask(options, evidence);
  if (!maskResult.ok) {
    return buildRejection('grammar-fail-closed', maskResult.reason, state, event, evidence);
  }
  const kernelResult = await executeKernel(codes.stateCode, codes.eventCode, maskResult.mask, options);
  if (kernelResult.parityError) {
    return buildRejection('wasm-js-parity-failure',
      'WASM and JS kernels disagree: ' + kernelResult.parityError, state, event, evidence);
  }
  const unpacked = kernelJs.unpack(kernelResult.packed);
  const verdict = {
    decision: unpacked.decisionName, reason: unpacked.reasonName,
    required_next: unpacked.requiredNextName,
    fsm_version: FSM_VERSION, grammar_version: GRAMMAR_VERSION,
    state, event, evidence_hash: evidence.evidence_hash, packed_i32: kernelResult.packed,
  };
  await signVerdict(verdict);
  return verdict;
}

module.exports = {
  evaluate,
  FSM_VERSION,
  GRAMMAR_VERSION,
  loadWasmKernel,
  // Re-export sub-modules for convenience
  STATES,
  EVENTS,
  EVIDENCE_BITS,
  DECISIONS,
};
