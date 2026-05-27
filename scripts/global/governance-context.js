'use strict';
// governance-context — inject canonical priority sentence + goal definitions
// into governed provider calls via wrapProviderCall opts.
// Refs Epic #2029 #2221. Mirrors goal_lens.py priority sentence at provider layer.

const PRIORITY_SENTENCE = 'Goal priority: G1 Governance > G2 Quality > G3 Zero Cost > G4 Privacy > G5 Portability > G6 Resilience > G7 Throughput > G8 Observability > G9 Interoperability > G10 Maintainability.';
const DECISION_CHECK = 'Decision check: justify any lower-priority override with explicit evidence.';

const GOAL_DEFINITIONS = {
  G1: 'Governance: policy, role, provenance, ticket controls non-negotiable.',
  G2: 'Quality: maximize correctness and engineering value.',
  G3: 'Zero Cost: prefer local/fleet/free lanes before paid providers.',
  G4: 'Privacy: keep sensitive context local unless explicit override.',
  G5: 'Portability: avoid user-specific coupling; settings-driven.',
  G6: 'Resilience: graceful degradation; fallback paths.',
  G7: 'Throughput: acceptable speed after higher-priority goals met.',
  G8: 'Observability: decisions visible, auditable, attributable.',
  G9: 'Interoperability: preserve compatibility across runtimes.',
  G10: 'Maintainability: code clarity, low cognitive overhead, durable structure.',
};

function shouldInject(opts) {
  if (!opts) return false;
  if (opts.tier === 'diagnostic' || opts.tier === 'test') return false;
  if (opts.inject_goal_context === false) return false;
  return opts.inject_goal_context !== undefined ? Boolean(opts.inject_goal_context) : true;
}

function buildPrefix({ includeDefinitions } = {}) {
  const lines = [PRIORITY_SENTENCE, DECISION_CHECK];
  if (includeDefinitions) {
    lines.push('Goal definitions:');
    for (const [key, def] of Object.entries(GOAL_DEFINITIONS)) {
      lines.push(`  ${key} ${def}`);
    }
  }
  return lines.join(' ');
}

function injectGoalContext(opts) {
  if (!shouldInject(opts)) return { systemPrefix: null, injected: false };
  const includeDefinitions = Boolean(opts && opts.include_goal_definitions);
  return { systemPrefix: buildPrefix({ includeDefinitions }), injected: true, includesDefinitions: includeDefinitions };
}

function estimateOverheadTokens({ includeDefinitions } = {}) {
  const PRIORITY_LINE_TOKEN_EST = 30;
  const DEFINITIONS_TOKEN_EST = 180;
  return includeDefinitions ? PRIORITY_LINE_TOKEN_EST + DEFINITIONS_TOKEN_EST : PRIORITY_LINE_TOKEN_EST;
}

module.exports = { injectGoalContext, shouldInject, buildPrefix,
  estimateOverheadTokens, PRIORITY_SENTENCE, DECISION_CHECK, GOAL_DEFINITIONS };
