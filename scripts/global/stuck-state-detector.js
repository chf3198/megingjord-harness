'use strict';
// stuck-state-detector.js — R2 of #3059 (#3748). The UNIFIED stuck-state detector that auto-routes a
// stuck-PR / ambiguous-gate / novel-failure into the shipped adjudication-guardrail.decide() cross-model
// panel — NEVER a client prompt. It REUSES the friction-sensors loop-fingerprint primitive
// (signature/detectRetries) instead of duplicating it, and adds the triggers that primitive lacks:
// iteration/token-budget cap, tool-error burst, cross-family self-consistency divergence, explicit signal.
//
// Escalate-vs-resolve is gated on REVERSIBILITY / BLAST-RADIUS (CSA autonomy dimensions), NEVER on
// self-reported confidence (self-consistent errors are confidently, repeatably wrong — #3059 §3). Ships
// ADVISORY; advisory→blocking promotion is replay-eval-gated (precision >=0.85), never calendar.
// Pure detection core (detectStuckState) is disk/network-free and NEVER throws; routeStuckState is the
// thin router that calls decide().
const { detectRetries } = require('./friction-sensors');

// Fire thresholds are strictly greater than clear thresholds → hysteresis (no single-blip flapping).
const DEFAULTS = {
  loopThreshold: 3, loopClear: 1,
  iterationCap: 25, iterationClear: 20,
  tokenBudgetCap: 1.0, tokenBudgetClear: 0.8,
  toolErrorBurst: 3, toolErrorClear: 1,
  divergenceFloor: 0.5,
};
const EXPLICIT_SIGNALS = new Set(['stuck-pr', 'ambiguous-gate', 'novel-failure']);

// Hysteresis gate: once active, stay active until value drops below `clear`; otherwise fire at `fire`.
function hyst(value, fire, clear, priorActive) {
  const v = Number.isFinite(value) ? value : 0;
  return priorActive ? v > clear : v >= fire;
}

// Fraction of sampled cross-family resolutions that disagree with the modal answer (0 when <2 samples).
function divergenceRatio(samples) {
  const xs = (samples || []).map((s) => String(s)).filter(Boolean);
  if (xs.length < 2) return 0;
  const counts = new Map();
  for (const x of xs) counts.set(x, (counts.get(x) || 0) + 1);
  const modal = Math.max(...counts.values());
  return 1 - modal / xs.length;
}

/**
 * Pure stuck-state detection over a signal bundle. Returns {stuck, triggers, gate} and NEVER throws.
 * `confidence` on the input is deliberately ignored — the axis is reversibility/blast-radius.
 * @param {object} signals {invocations,iterationCount,tokenBudgetFraction,toolErrorCount,sampledResolutions,explicit,reversibility,blastRadius}
 * @param {object} [opts] threshold overrides + {prior:{...}} for hysteresis state
 */
function detectStuckState(signals = {}, opts = {}) {
  try {
    const t = { ...DEFAULTS, ...opts };
    const prior = opts.prior || {};
    const triggers = [];
    if (detectRetries(signals.invocations, { threshold: t.loopThreshold }).length) triggers.push('loop-fingerprint');
    if (hyst(signals.iterationCount, t.iterationCap, t.iterationClear, prior.iteration)) triggers.push('iteration-cap');
    if (hyst(signals.tokenBudgetFraction, t.tokenBudgetCap, t.tokenBudgetClear, prior.token)) triggers.push('token-budget-cap');
    if (hyst(signals.toolErrorCount, t.toolErrorBurst, t.toolErrorClear, prior.toolError)) triggers.push('tool-error-burst');
    if (divergenceRatio(signals.sampledResolutions) >= t.divergenceFloor) triggers.push('self-consistency-divergence');
    if (EXPLICIT_SIGNALS.has(signals.explicit)) triggers.push(String(signals.explicit));
    return {
      stuck: triggers.length > 0,
      triggers,
      gate: { reversibility: signals.reversibility || 'reversible', blastRadius: signals.blastRadius || 'low' },
    };
  } catch { return { stuck: false, triggers: [], gate: { reversibility: 'reversible', blastRadius: 'low' }, error: true }; }
}

// Map the reversibility/blast-radius gate onto decide()'s carve-out flags. An IRREVERSIBLE or
// high-destructive-blast decision is the only thing that reaches the human; everything else adjudicates.
function gateToFlags(gate) {
  const g = gate || {};
  const irreversible = g.reversibility === 'irreversible' || g.blastRadius === 'high-destructive';
  return { irreversible, needsOpinion: true };
}

/**
 * Route a detected stuck-state into the cross-model adjudication guardrail (ADVISORY). Returns
 * {detected:false} when not stuck; otherwise the decide() record. NEVER prompts the client directly —
 * decide()'s classifyDecision owns the 4 carve-outs; below the diversity floor it self-resolves.
 */
async function routeStuckState(signals = {}, opts = {}) {
  const det = detectStuckState(signals, opts);
  if (!det.stuck) return { detected: false, advisory: true, triggers: [] };
  const decide = (opts.decide) || require('./adjudication-guardrail').decide;
  const question = opts.question
    || `Stuck-state detected (${det.triggers.join(', ')}); how should the operator resolve it autonomously?`;
  const decision = { question, options: opts.options || [], flags: { ...gateToFlags(det.gate), ...(opts.flags || {}) } };
  const record = await decide(decision, opts);
  return { detected: true, advisory: true, triggers: det.triggers, gate: det.gate, decision: record };
}

module.exports = { detectStuckState, routeStuckState, divergenceRatio, hyst, gateToFlags, EXPLICIT_SIGNALS, DEFAULTS };
