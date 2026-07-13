'use strict';
// stuck-state-detector.js — R2 of #3059 (#3748). Unified stuck-state detector that auto-routes a
// stuck-PR / ambiguous-gate / novel-failure into the shipped adjudication-guardrail.decide() cross-model
// panel — NEVER a client prompt. REUSES the friction-sensors loop-fingerprint primitive and adds the
// triggers it lacks (iteration/token-budget cap, tool-error burst, self-consistency divergence, explicit
// signal). Escalate-vs-resolve is gated on REVERSIBILITY / BLAST-RADIUS, never self-reported confidence
// (#3059 §3). Ships ADVISORY; promotion is replay-eval-gated (precision >=0.85), never calendar. The pure
// core (detectStuckState) is disk/network-free and NEVER throws; routeStuckState is the thin router.
const { detectRetries } = require('./friction-sensors');

// Fire thresholds are strictly greater than clear thresholds → hysteresis (no single-blip flapping).
const DEFAULTS = {
  loopThreshold: 3, loopClear: 1, iterationCap: 25, iterationClear: 20, tokenBudgetCap: 1.0,
  tokenBudgetClear: 0.8, toolErrorBurst: 3, toolErrorClear: 1, divergenceFloor: 0.5,
};
const EXPLICIT_SIGNALS = new Set(['stuck-pr', 'ambiguous-gate', 'novel-failure']);

/**
 * Hysteresis gate: once active, stay active until `value` drops below `clear`; else fire at `fire`.
 * @param {number} value observed counter
 * @param {number} fire fire threshold
 * @param {number} clear clear (lower) threshold
 * @param {boolean} priorActive whether the signal was active on the previous evaluation
 * @returns {boolean} whether the signal is active now
 */
function hyst(value, fire, clear, priorActive) {
  const num = Number.isFinite(value) ? value : 0;
  return priorActive ? num > clear : num >= fire;
}

/**
 * Fraction of sampled cross-family resolutions that disagree with the modal answer.
 * @param {Array} samples sampled resolution labels
 * @returns {number} divergence ratio in [0,1); 0 when fewer than 2 samples
 */
function divergenceRatio(samples) {
  const labels = (samples || []).map((entry) => String(entry)).filter(Boolean);
  if (labels.length < 2) return 0;
  const counts = new Map();
  for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
  return 1 - Math.max(...counts.values()) / labels.length;
}

/**
 * Pure stuck-state detection over a signal bundle. NEVER throws. `signals.confidence` is deliberately
 * ignored — the axis is reversibility/blast-radius, not self-reported confidence.
 * @param {object} signals {invocations,iterationCount,tokenBudgetFraction,toolErrorCount,sampledResolutions,explicit,reversibility,blastRadius}
 * @param {object} [opts] threshold overrides + {prior:{iteration,token,toolError}} hysteresis state
 * @returns {{stuck:boolean, triggers:string[], gate:{reversibility:string, blastRadius:string}}} detection result
 */
function detectStuckState(signals = {}, opts = {}) {
  try {
    const cfg = { ...DEFAULTS, ...opts };
    const prior = opts.prior || {};
    const sig = signals;
    const checks = [
      ['loop-fingerprint', detectRetries(sig.invocations, { threshold: cfg.loopThreshold }).length > 0],
      ['iteration-cap', hyst(sig.iterationCount, cfg.iterationCap, cfg.iterationClear, prior.iteration)],
      ['token-budget-cap', hyst(sig.tokenBudgetFraction, cfg.tokenBudgetCap, cfg.tokenBudgetClear, prior.token)],
      ['tool-error-burst', hyst(sig.toolErrorCount, cfg.toolErrorBurst, cfg.toolErrorClear, prior.toolError)],
      ['self-consistency-divergence', divergenceRatio(sig.sampledResolutions) >= cfg.divergenceFloor],
      [String(sig.explicit), EXPLICIT_SIGNALS.has(sig.explicit)],
    ];
    const triggers = checks.filter(([, fired]) => fired).map(([name]) => name);
    return { stuck: triggers.length > 0, triggers, gate: { reversibility: sig.reversibility || 'reversible', blastRadius: sig.blastRadius || 'low' } };
  } catch { return { stuck: false, triggers: [], gate: { reversibility: 'reversible', blastRadius: 'low' }, error: true }; }
}

/**
 * Map the reversibility/blast-radius gate onto decide()'s carve-out flags. Only an IRREVERSIBLE or
 * high-destructive-blast decision reaches the human; everything else adjudicates.
 * @param {object} gate {reversibility, blastRadius}
 * @returns {{irreversible:boolean, needsOpinion:boolean}} flags for adjudication-guardrail.decide()
 */
function gateToFlags(gate) {
  const gt = gate || {};
  return { irreversible: gt.reversibility === 'irreversible' || gt.blastRadius === 'high-destructive', needsOpinion: true };
}

/**
 * Route a detected stuck-state into the cross-model adjudication guardrail (ADVISORY). Returns
 * {detected:false} when not stuck; otherwise the decide() record. NEVER prompts the client directly —
 * decide()'s classifyDecision owns the 4 carve-outs; below the diversity floor it self-resolves.
 * @param {object} signals detection signal bundle (see detectStuckState)
 * @param {object} [opts] {decide, question, options, flags, ...decideOpts}
 * @returns {Promise<object>} {detected, advisory, triggers, gate?, decision?}
 */
async function routeStuckState(signals = {}, opts = {}) {
  const det = detectStuckState(signals, opts);
  if (!det.stuck) return { detected: false, advisory: true, triggers: [] };
  const decide = opts.decide || require('./adjudication-guardrail').decide;
  const question = opts.question
    || `Stuck-state detected (${det.triggers.join(', ')}); how should the operator resolve it autonomously?`;
  const decision = { question, options: opts.options || [], flags: { ...gateToFlags(det.gate), ...(opts.flags || {}) } };
  const record = await decide(decision, opts);
  return { detected: true, advisory: true, triggers: det.triggers, gate: det.gate, decision: record };
}

module.exports = { detectStuckState, routeStuckState, divergenceRatio, hyst, gateToFlags, EXPLICIT_SIGNALS, DEFAULTS };
