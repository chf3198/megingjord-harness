'use strict';
// tier: 1
// honest-degradation.js (Epic #3807 / #3813, C5) — the reusable "correctness != reachability"
// wrapper for externally-coupled gates. Phase-0 design of record:
// research/governance-surface-debt-phase0-3808.md §5.
//
// The rule it encodes: a gate whose input depends on VOLATILE EXTERNAL LIVENESS (a cloud panel,
// the GitHub API, a fleet host) must give its `reachable?` pre-check a status distinct from its
// `pass?` check. When the dependency is unreachable the gate returns `cannot-verify` — a VISIBLE
// advisory non-pass with an operator-visible signal (G8) — and NEVER hard-blocks completed work as
// though it had FAILED. This generalizes the ad-hoc pattern already shipped in
// scripts/global/cross-model-review-dispatch.js (degrades to programmatic-only, never hard-fails)
// so the next externally-coupled gate inherits honest degradation by default instead of growing a
// fresh bypass flag to paper over a hard block. Pure + read-only: it mutates no governed file.

// Errors that mean "we could not reach the dependency" (liveness), NOT "the check failed"
// (correctness). Reachability failures degrade honestly; correctness failures are real verdicts.
const LIVENESS_SIGNALS = [
  'ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENETUNREACH',
  'socket hang up', 'network', 'timeout', 'timed out', 'unreachable', 'fetch failed',
  'gh-fetch-failed', 'offline', 'empty', 'no reachable',
];

function classifyLivenessError(err) {
  if (!err) return false;
  const text = `${err.code || ''} ${err.message || err}`.toLowerCase();
  return LIVENESS_SIGNALS.some((signal) => text.includes(signal.toLowerCase()));
}

// The operator-visible advisory line for a cannot-verify degrade. Never silent (G8); names only,
// no secret values (G4). Callers may print it to stderr or attach it to a gate result.
function honestSignal(gateName, reason) {
  return `[honest-degradation] ${gateName}: cannot-verify — external dependency unreachable ` +
    `(${reason}); degrading to advisory, NOT a failure of completed work.`;
}

function isCannotVerify(result) {
  return Boolean(result) && result.status === 'cannot-verify';
}

// Wrap an externally-coupled gate. `probe()` establishes reachability (bool, may throw); `evaluate()`
// runs the real pass?/fail? check only when reachable. Unreachable OR a liveness error mid-evaluate
// => cannot-verify (visible advisory, never throws). A genuine (non-liveness) evaluate error is a
// real defect and is re-thrown so it surfaces rather than masquerading as a degrade.
async function guardExternalGate({ name = 'external-gate', probe, evaluate }) {
  let reachable = false;
  try {
    reachable = typeof probe === 'function' ? Boolean(await probe()) : true;
  } catch (probeErr) {
    reachable = false;
    if (!classifyLivenessError(probeErr)) throw probeErr;
  }
  if (!reachable) {
    const reason = 'probe reported unreachable';
    return { status: 'cannot-verify', reachable: false, signal: honestSignal(name, reason) };
  }
  try {
    const verdict = await evaluate();
    const passed = Boolean(verdict && verdict.pass);
    return { status: passed ? 'pass' : 'fail', reachable: true, detail: verdict && verdict.detail };
  } catch (evalErr) {
    if (!classifyLivenessError(evalErr)) throw evalErr;
    return { status: 'cannot-verify', reachable: false, signal: honestSignal(name, evalErr.message || 'liveness error') };
  }
}

// Honest availability default for a two-transport selector: only claim the externally-coupled
// `preferred` path when its availability is EXPLICITLY asserted; otherwise degrade to the
// always-reachable `fallback`. A `disabled` opt-out forces the fallback. This is the sync shape the
// github-dispatcher consumes to retire MEGINGJORD_MCP_FORCE_AVAILABLE — a "force preferred" knob
// that asserted availability without ever probing it.
function degradeDefault(preferred, { asserted = false, disabled = false, fallback }) {
  if (disabled) return fallback;
  return asserted ? preferred : fallback;
}

module.exports = {
  classifyLivenessError, honestSignal, isCannotVerify, guardExternalGate, degradeDefault,
  LIVENESS_SIGNALS,
};
