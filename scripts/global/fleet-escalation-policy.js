'use strict';
// tier: 3
// Fleet escalation policy (#2930 / Epic #2926 C4). Encodes the #2619 cost-ascending mandate as a
// HARD rule plus a circuit-breaker, so an OUTAGE can never reach a paid tier:
//   AVAILABILITY failure (no answer produced): fleet -> free-cloud ($0), breaker-gated; NEVER premium.
//   CAPABILITY failure (answered but failed the judge/quality gate): exactly ONE tier up the PAID
//     ladder — fleet->haiku, free-cloud->premium. Premium is reachable ONLY from a free-cloud-tier
//     capability failure, never from an outage.
// Reuses the pure, time-injected scripts/global/circuit-breaker.js (no new breaker implementation).
// G3 (zero-cost: outage stays $0) + G6 (resilience: breaker stops hammering a down fleet).

const cb = require('./circuit-breaker');

// Reasons that mean "no usable answer was produced" — an availability failure, not a quality one.
// 'circuit-open' = the breaker skipped the fleet attempt (known-down) — an availability condition.
const AVAILABILITY_REASONS = new Set(['ollama_unreachable', 'fleet_unavailable', 'cascade_script_not_found', 'circuit-open']);
const CONNECTION_RE = /econnrefused|fetch failed|timeout|network|enotfound|socket hang|connect/i;

function classifyFailure(reason) {
  if (!reason) return 'capability';
  if (AVAILABILITY_REASONS.has(reason) || CONNECTION_RE.test(String(reason))) return 'availability';
  return 'capability';
}

// Capability ladder: the next PAID tier to try after `currentTier` produced a bad answer.
// free-cloud is the ONLY rung from which premium is reachable (D4).
const CAPABILITY_NEXT = Object.freeze({ fleet: 'haiku', 'free-cloud': 'premium', haiku: 'premium', premium: 'premium' });

/**
 * Decide the next tier for a failure. Availability failures are hard-pinned to free-cloud and
 * record a breaker failure; capability failures step exactly one rung up the paid ladder.
 * @returns {{tier, failureClass, breakerOpen, premiumBlocked}}
 */
function escalate({ reason, currentTier = 'fleet', breaker = null, nowMs = 0 } = {}) {
  const failureClass = classifyFailure(reason);
  if (failureClass === 'availability') {
    if (breaker) cb.recordFailure(breaker, nowMs);
    const breakerOpen = breaker ? cb.status(breaker).state === cb.STATES.open : false;
    // Hard invariant: an outage never escalates to a paid tier — always the $0 cloud failover.
    return { tier: 'free-cloud', failureClass, breakerOpen, premiumBlocked: true };
  }
  return { tier: CAPABILITY_NEXT[currentTier] || 'haiku', failureClass, breakerOpen: false, premiumBlocked: false };
}

/** Back-compat tier string for cascade-dispatch.escalationTier (fleet-origin). */
function tierFor(reason) {
  return escalate({ reason, currentTier: 'fleet' }).tier;
}

module.exports = { classifyFailure, escalate, tierFor, AVAILABILITY_REASONS, CAPABILITY_NEXT };
