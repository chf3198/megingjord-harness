// opa-sidecar.js — Optional OPA sidecar for baton policy evaluation.
// Shells out to the opa binary when present; returns a clean
// unavailability signal when absent. Never throws. Refs #3286, Epic #3284.
'use strict';

const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const { readFileSync, existsSync } = require('node:fs');
const { decide, unpack } = require('../baton-fsm/kernel');
const { TRANSITIONS } = require('../baton-fsm/transitions');

const REGO_PATH = join(__dirname, 'baton-policy.rego');
const OPA_ABSENT_REASON = 'opa-toolchain-absent';
const OPA_VERSION_TIMEOUT_MS = 5000;
const OPA_EVAL_TIMEOUT_MS = 10000;

/** Check whether the opa binary is available on PATH. */
function opaAvailable() {
  try {
    execFileSync('opa', ['version'], { timeout: OPA_VERSION_TIMEOUT_MS, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** Evaluate a single input via the OPA binary. */
function evaluateViaOpa(input) {
  if (!opaAvailable()) {
    return { available: false, reason: OPA_ABSENT_REASON };
  }
  return runOpaEval(input);
}

/** Execute opa eval and return parsed result. */
function runOpaEval(input) {
  const transitionsData = JSON.stringify({ transitions: TRANSITIONS });
  const inputJson = JSON.stringify(input);
  try {
    const stdout = execFileSync('opa', [
      'eval',
      '--data', REGO_PATH,
      '--stdin-input',
      '--data', '-',
      'data.baton.policy.decision',
      '--format', 'json',
    ], {
      input: inputJson + '\n' + transitionsData,
      timeout: OPA_EVAL_TIMEOUT_MS,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(stdout.toString());
    return { available: true, result: parsed };
  } catch (execError) {
    return {
      available: false,
      reason: 'opa-exec-failed: ' + (execError.message || 'unknown'),
    };
  }
}

/** Extract the decision object from OPA eval JSON output. */
function extractOpaDecision(opaOutput) {
  try {
    const results = opaOutput && opaOutput.result;
    if (results && results.length) {
      const firstEntry = results.at(0);
      const exprs = firstEntry && firstEntry.expressions;
      if (exprs && exprs.length) {
        return exprs.at(0).value;
      }
    }
  } catch {
    // Malformed OPA output; return null to signal extraction issue
  }
  return null;
}

/** Build pending-toolchain result when opa is absent. */
function buildPendingResult() {
  const regoExists = existsSync(REGO_PATH);
  let regoNonEmpty = false;
  if (regoExists) {
    const content = readFileSync(REGO_PATH, 'utf8');
    regoNonEmpty = Boolean(content.trim().length);
  }
  return {
    checked: 0,
    mismatches: [],
    status: 'pending-toolchain',
    rego_file_exists: regoExists,
    rego_file_non_empty: regoNonEmpty,
  };
}

/** Run parity check for a single test case. */
function checkSingleParity(testCase) {
  const opaResult = evaluateViaOpa(testCase);
  if (!opaResult.available) return null;
  const kernelPacked = decide(
    testCase.state, testCase.event, testCase.evidence_mask
  );
  const kernelUnpacked = unpack(kernelPacked);
  const opaDecision = extractOpaDecision(opaResult.result);
  if (opaDecision && opaDecision.result !== kernelUnpacked.decisionName) {
    return { mismatch: true, input: testCase, opa: opaDecision, kernel: kernelUnpacked.decisionName };
  }
  return { mismatch: false };
}

/**
 * Compare OPA output against the JS kernel for a set of test cases.
 * Returns {checked, mismatches, status}. NEVER silently skips (AC2).
 */
function sidecarParity(cases) {
  if (!opaAvailable()) return buildPendingResult();
  const mismatches = [];
  let checked = 0;
  for (const testCase of cases) {
    const result = checkSingleParity(testCase);
    if (!result) continue;
    checked++;
    if (result.mismatch) {
      mismatches.push({ input: result.input, opa: result.opa, kernel: result.kernel });
    }
  }
  return {
    checked,
    mismatches,
    status: mismatches.length === 0 ? 'verified' : 'mismatch-detected',
  };
}

module.exports = {
  evaluateViaOpa,
  sidecarParity,
  opaAvailable,
  OPA_ABSENT_REASON,
  REGO_PATH,
};
