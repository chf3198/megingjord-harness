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

const { capabilityFor, loadCapabilities } = require('./fleet-registry');

// $0 tiers. Anything else is paid (G3).
const FREE_TIERS = new Set(['local', 'free-cloud']);

// Adequacy bar per task class. A candidate below the bar cannot do the job, so picking it
// would be a G2 failure dressed up as a G3 win.
const QUALITY_BARS = { routine: 0.4, standard: 0.55, 'high-stakes': 0.7, judge: 0.5 };

function isFree(candidate) {
  return FREE_TIERS.has(candidate.tier);
}

function qualityScore(candidate) {
  const q = Number(candidate.quality);
  return Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0.5;
}

// Normalize latency into 0..1 (higher = faster). Tie-breaker only — never outranks cost.
function speedScore(candidate) {
  const t = Number(candidate.timeout_ms) || 120000;
  return 1 / (1 + t / 60000);
}

function qualityBarFor(taskClass) {
  return QUALITY_BARS[taskClass] != null ? QUALITY_BARS[taskClass] : QUALITY_BARS.standard;
}

function enrich(panel, caps) {
  return (Array.isArray(panel) ? panel : []).map((c) => {
    const cap = c.model ? capabilityFor(c.model, caps) : {};
    return {
      ...c,
      family: c.family || cap.family || 'unknown',
      quality: c.quality != null ? c.quality : cap.quality,
      judge_eligible: c.judge_eligible != null ? c.judge_eligible : (cap.judge_eligible !== false),
      timeout_ms: c.timeout_ms || cap.timeout_ms || 120000,
      free: isFree(c),
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
  for (const c of ranked) {
    if (picked.length >= size) break;
    if (usedFamilies.has(c.family)) continue;
    picked.push(c);
    usedFamilies.add(c.family);
  }
  if (picked.length < size) {
    for (const c of ranked) {
      if (picked.length >= size) break;
      if (!picked.includes(c)) picked.push(c);
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
