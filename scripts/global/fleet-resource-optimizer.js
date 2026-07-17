// tier: 3
// fleet-resource-optimizer.js (Epic #3126 AC6): pick the OPTIMAL fleet resource per task
// by a goal-weighted objective, not by raw speed.
//
// DESIGN NOTE (why this is not a weighted sum):
// A linear "G2*quality + G3*cost + G7*speed" sum lets a marginal quality gain buy a paid
// escalation (observed in development: a 0.82-quality $0 local model lost to a 0.95-quality
// paid model, silently defeating G3). The harness's cost-ascending mandate is instead a
// LEXICOGRAPHIC rule — "start in the lowest ADEQUATE lane; never skip a lane to reach
// premium". So quality is an adequacy THRESHOLD, and among adequate candidates cost
// dominates. Ordering: adequate -> free-before-paid -> quality -> speed.
'use strict';

const { capabilityFor, loadCapabilities, UNKNOWN_MODEL_TIMEOUT_MS } = require('./fleet-registry');

// Quality assumed for a candidate that declares none — mid-scale, so an undeclared model is
// neither trusted nor dismissed on a guess.
const ASSUMED_QUALITY = 0.5;
// Latency normalizer: a candidate whose budget equals this scores 0.5, so speed stays a
// bounded 0..1 tie-breaker that can never outweigh cost.
const SPEED_HALF_LIFE_MS = 60_000;

// $0 tiers. Anything else is paid (G3).
const FREE_TIERS = new Set(['local', 'free-cloud']);

// Adequacy bar per task class. A candidate below the bar cannot do the job, so picking it
// would be a G2 failure dressed up as a G3 win.
const QUALITY_BARS = { routine: 0.4, standard: 0.55, 'high-stakes': 0.7, judge: 0.5 };

function isFree(candidate) {
  return FREE_TIERS.has(candidate.tier);
}

function qualityScore(candidate) {
  const quality = Number(candidate.quality);
  return Number.isFinite(quality) ? Math.max(0, Math.min(1, quality)) : ASSUMED_QUALITY;
}

// Normalize latency into 0..1 (higher = faster). Tie-breaker only — never outranks cost.
function speedScore(candidate) {
  const budgetMs = Number(candidate.timeout_ms) || UNKNOWN_MODEL_TIMEOUT_MS;
  return 1 / (1 + budgetMs / SPEED_HALF_LIFE_MS);
}

function qualityBarFor(taskClass) {
  return QUALITY_BARS[taskClass] != null ? QUALITY_BARS[taskClass] : QUALITY_BARS.standard;
}

function enrich(panel, caps) {
  return (Array.isArray(panel) ? panel : []).map((candidate) => {
    const cap = candidate.model ? capabilityFor(candidate.model, caps) : {};
    return {
      ...candidate,
      family: candidate.family || cap.family || 'unknown',
      quality: candidate.quality != null ? candidate.quality : cap.quality,
      judge_eligible: candidate.judge_eligible != null
        ? candidate.judge_eligible : (cap.judge_eligible !== false),
      timeout_ms: candidate.timeout_ms || cap.timeout_ms || UNKNOWN_MODEL_TIMEOUT_MS,
      free: isFree(candidate),
    };
  });
}

// Lexicographic comparator: free-before-paid, then quality desc, then speed desc.
// Cost outranks quality HERE because callers only ever compare already-adequate candidates.
function compareAdequate(a, b) {
  if (a.free !== b.free) return a.free ? -1 : 1;
  const dq = qualityScore(b) - qualityScore(a);
  if (dq) return dq;
  const ds = speedScore(b) - speedScore(a);
  if (ds) return ds;
  return String(a.model || a.provider).localeCompare(String(b.model || b.provider));
}

// Rank a preflight-derived panel. Adequate candidates always precede inadequate ones;
// inadequate candidates are kept (sorted by quality) so a caller can report the shortfall
// rather than get an empty list (G6: degrade, never vanish).
function rankResources(panel, opts = {}) {
  const caps = opts.caps || loadCapabilities();
  const bar = opts.minQuality != null ? opts.minQuality : qualityBarFor(opts.taskClass);
  let enriched = enrich(panel, caps);
  if (opts.requireJudge) enriched = enriched.filter((c) => c.judge_eligible);
  const adequate = enriched.filter((c) => qualityScore(c) >= bar).sort(compareAdequate);
  const inadequate = enriched.filter((c) => qualityScore(c) < bar).sort((a, b) => qualityScore(b) - qualityScore(a));
  return [...adequate, ...inadequate];
}

// The G3 decision. Returns the cheapest adequate resource, plus an explicit escalation
// record when no $0 option clears the bar — so a paid call is always auditable (G8),
// never silent.
function selectOptimal(panel, opts = {}) {
  const caps = opts.caps || loadCapabilities();
  const bar = opts.minQuality != null ? opts.minQuality : qualityBarFor(opts.taskClass);
  let enriched = enrich(panel, caps);
  if (opts.requireJudge) enriched = enriched.filter((c) => c.judge_eligible);
  const adequate = enriched.filter((c) => qualityScore(c) >= bar).sort(compareAdequate);

  if (!adequate.length) {
    const best = enriched.sort((a, b) => qualityScore(b) - qualityScore(a))[0] || null;
    return best
      ? { ...best, selected: false, escalate: true, escalation_reason: `no_candidate_meets_quality_bar_${bar}` }
      : null;
  }
  const pick = adequate[0];
  const freeExists = adequate.some((c) => c.free);
  return {
    ...pick,
    selected: true,
    escalate: !pick.free,
    // A paid pick is only legitimate when no free candidate cleared the bar.
    escalation_reason: pick.free ? null : (freeExists ? 'unexpected_paid_over_free' : `no_free_candidate_meets_bar_${bar}`),
  };
}

// Build the most family-diverse jury available: take the best adequate candidate from each
// distinct family before ever taking a second member of a family. Direct fix for the
// correlated-panel collapse (a Llama trio anchoring every score at ~82).
function selectDiversePanel(panel, size = 3, opts = {}) {
  const ranked = rankResources(panel, { ...opts, requireJudge: opts.requireJudge !== false });
  const picked = [];
  const usedFamilies = new Set();
  for (const candidate of ranked) {
    if (picked.length >= size) break;
    if (usedFamilies.has(candidate.family)) continue;
    picked.push(candidate);
    usedFamilies.add(candidate.family);
  }
  if (picked.length < size) {
    for (const candidate of ranked) {
      if (picked.length >= size) break;
      if (!picked.includes(candidate)) picked.push(candidate);
    }
  }
  return picked;
}

// Dispatch options the registry implies for a model — the thing whose absence caused the
// 306s qwen3:32b timeout (a thinking model at low num_predict returns empty content).
function dispatchOptionsFor(model, caps = loadCapabilities()) {
  const cap = capabilityFor(model, caps);
  return {
    model,
    timeout_ms: cap.timeout_ms,
    think: cap.thinking ? false : undefined,
    expected_cold_load_s: cap.cold_load_s,
  };
}

module.exports = {
  rankResources, selectOptimal, selectDiversePanel, dispatchOptionsFor,
  qualityScore, speedScore, isFree, qualityBarFor,
  QUALITY_BARS, FREE_TIERS, compareAdequate,
};
