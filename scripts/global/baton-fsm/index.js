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
 * Evaluate a baton transition request.
 *
 * Steps:
 *   (a) verifyEvidence provenance - reject forged
 *   (b) canonicalize via grammar - fail-closed
 *   (c) map facts to evidenceMask
 *   (d) call the kernel (JS ref by default; useWasm option loads kernel.wasm)
 *   (e) build verdict object
 *   (f) Ed25519-sign the verdict
 *
 * @param {string} state - Current state name (e.g., 'triage').
 * @param {string} event - Event name (e.g., 'manager_handoff').
 * @param {object} evidence - Signed evidence envelope from provenance.createEvidence().
 * @param {object} [options] - Options: {useWasm: boolean, artifactText: string}.
 * @returns {Promise<object>} Signed verdict.
 */
async function evaluate(state, event, evidence, options = {}) {
  // Step (a): verify evidence provenance
  const provenanceResult = verifyEvidence(evidence);
  if (!provenanceResult.valid) {
    return buildRejection('provenance-invalid', provenanceResult.reason, state, event, evidence);
  }
  // Resolve state and event codes
  const stateKey = state.toUpperCase().replace(/-/g, '_');
  const eventKey = event.toUpperCase();
  const stateCode = STATES[stateKey];
  const eventCode = EVENTS[eventKey];
  if (stateCode === undefined) {
    return buildRejection('invalid-state', 'unknown state: ' + state, state, event, evidence);
  }
  if (eventCode === undefined) {
    return buildRejection('invalid-event', 'unknown event: ' + event, state, event, evidence);
  }
  // Step (b): canonicalize artifact text via grammar (if provided)
  let evidenceMask = 0;
  if (options.artifactText) {
    const grammarResult = canonicalize(options.artifactText);
    if (!grammarResult.ok) {
      return buildRejection('grammar-fail-closed', grammarResult.reason, state, event, evidence);
    }
    evidenceMask = grammarResult.mask;
  } else if (evidence.facts && typeof evidence.facts.mask === 'number') {
    // Step (c): use pre-computed mask from facts
    evidenceMask = evidence.facts.mask;
  }
  // Step (d): call the kernel
  let decideFn = kernelJs.decide;
  if (options.useWasm) {
    const wasmDecide = await loadWasmKernel();
    const wasmResult = wasmDecide(stateCode, eventCode, evidenceMask);
    const jsResult = kernelJs.decide(stateCode, eventCode, evidenceMask);
    if (wasmResult !== jsResult) {
      return buildRejection('wasm-js-parity-failure',
        'WASM and JS kernels disagree: wasm=' + wasmResult + ' js=' + jsResult,
        state, event, evidence);
    }
    decideFn = () => wasmResult;
  }
  const packed = decideFn(stateCode, eventCode, evidenceMask);
  const unpacked = kernelJs.unpack(packed);
  // Step (e): build verdict object
  const verdict = {
    decision: unpacked.decisionName,
    reason: unpacked.reasonName,
    required_next: unpacked.requiredNextName,
    fsm_version: FSM_VERSION,
    grammar_version: GRAMMAR_VERSION,
    state,
    event,
    evidence_hash: evidence.evidence_hash,
    packed_i32: packed,
  };
  // Step (f): sign the verdict
  if (batonSigning) {
    const signed = await batonSigning.sign(JSON.stringify(verdict));
    verdict.signature = signed.signature;
    verdict.signer_key_id = signed.key_id;
    verdict.signed_at = signed.timestamp;
  }
  return verdict;
}

/**
 * Build a rejection verdict for pre-kernel failures.
 */
async function buildRejection(decision, reason, state, event, evidence) {
  const verdict = {
    decision: 'deny',
    reason,
    required_next: 'none',
    fsm_version: FSM_VERSION,
    grammar_version: GRAMMAR_VERSION,
    state,
    event,
    evidence_hash: evidence ? evidence.evidence_hash : 'none',
    rejection_source: decision,
  };
  if (batonSigning) {
    const signed = await batonSigning.sign(JSON.stringify(verdict));
    verdict.signature = signed.signature;
    verdict.signer_key_id = signed.key_id;
    verdict.signed_at = signed.timestamp;
  }
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
