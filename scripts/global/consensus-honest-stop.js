// tier: 3
// consensus-honest-stop.js (Epic #3126 AC4): stop honestly instead of burning iterations
// against a numerically unreachable gate.
//
// Observed failure: when the free panel collapses to a correlated set (a Llama-70B trio +
// Mistral), scores anchor near 82 and a `>93` gate is STRUCTURALLY unreachable — but the
// loop had no honest stop, so it re-dispatched forever, spending the very budget the $0
// panel exists to save. This module answers one question: "can this panel even reach the
// gate?" — and if not, says so.
'use strict';

// Independent families needed before a numeric gate is meaningful. Below this, the panel is
// measuring one opinion several times, and its agreement is an artifact, not a signal.
const MIN_INDEPENDENT_FAMILIES = 2;

function distinctFamilies(panel) {
  return [...new Set((Array.isArray(panel) ? panel : []).map((c) => c.family).filter(Boolean))];
}

// Correlated panel: two members of the SAME family are not two opinions. The reachable
// ceiling is estimated from the distinct families actually present.
function isCorrelated(panel) {
  const fams = distinctFamilies(panel);
  return fams.length < MIN_INDEPENDENT_FAMILIES;
}

// Estimated consensus ceiling for a panel. Each independent family adds headroom; a
// single-family panel cannot credibly exceed its own anchor.
function consensusMax(panel, opts = {}) {
  const perFamily = opts.perFamilyHeadroom != null ? opts.perFamilyHeadroom : 6;
  const base = opts.baseAnchor != null ? opts.baseAnchor : 82;
  const fams = distinctFamilies(panel);
  if (!fams.length) return 0;
  return Math.min(100, base + perFamily * (fams.length - 1));
}

// The decision a consensus loop should consult BEFORE each iteration.
// Returns {proceed, stop_reason, consensus_max, families} — never throws (G6).
function evaluateGate(panel, gate, opts = {}) {
  const families = distinctFamilies(panel);
  const max = consensusMax(panel, opts);
  const target = Number(gate);

  if (!families.length) {
    return { proceed: false, stop_reason: 'no_usable_panel', consensus_max: 0, families, gate: target };
  }
  if (isCorrelated(panel)) {
    return {
      proceed: false,
      stop_reason: `correlated_panel_${families.length}_family`,
      consensus_max: max, families, gate: target,
      report: `consensus-max=${max} on [${families.join(', ')}] — panel is single-family; agreement is an artifact, not independence.`,
    };
  }
  if (Number.isFinite(target) && target > max) {
    return {
      proceed: false,
      stop_reason: 'gate_unreachable_on_available_panel',
      consensus_max: max, families, gate: target,
      report: `consensus-max=${max} on [${families.join(', ')}] — gate ${target} is structurally unreachable; stopping honestly rather than iterating.`,
    };
  }
  return {
    proceed: true, stop_reason: null, consensus_max: max, families, gate: target,
    report: `consensus-max=${max} on [${families.join(', ')}] — gate ${target} is reachable.`,
  };
}

// Bounded loop guard: an iteration is only worth spending if the gate is reachable AND we
// have not exhausted the budget AND the score is still improving.
function shouldIterate(state = {}, opts = {}) {
  const maxIters = opts.maxIterations != null ? opts.maxIterations : 3;
  const iters = Number(state.iterations) || 0;
  if (iters >= maxIters) return { iterate: false, reason: `max_iterations_${maxIters}` };
  const gateEval = evaluateGate(state.panel || [], state.gate, opts);
  if (!gateEval.proceed) return { iterate: false, reason: gateEval.stop_reason, ...gateEval };
  // No improvement across a full round means more rounds will not help either.
  if (state.lastScore != null && state.prevScore != null && state.lastScore <= state.prevScore) {
    return { iterate: false, reason: 'no_score_improvement', ...gateEval };
  }
  return { iterate: true, reason: null, ...gateEval };
}

module.exports = {
  evaluateGate, consensusMax, distinctFamilies, isCorrelated, shouldIterate,
  MIN_INDEPENDENT_FAMILIES,
};
