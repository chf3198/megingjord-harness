/**
 * Fleet Advisor — Layer-② AI-research pass + report merger (Epic #3414 #3481, Phase-0 #3415 §3.2).
 *
 * The deterministic Layer-① lint (fleet-advisor-lint.js) is the FLOOR; this is the CEILING. It asks
 * the free panel (fleet-first → free-cloud failover, $0) what current best-practice, zero-cost changes
 * would raise throughput + tool-use reliability for the detected hardware + the lint's flagged gaps.
 *
 * Everything here is advisory. Three structural guards keep the non-deterministic layer honest:
 *   1. lint-authoritative merge — a deterministic finding always wins a tie; an AI-only finding is
 *      NEVER auto-promoted to `high`.
 *   2. trust controls — tiered freshness demotion, citation-or-low-trust, quantified-gain; a stale or
 *      uncited claim is capped at `informational`, and past a hard max-staleness it is dropped.
 *   3. best-effort + non-blocking — bounded retry/backoff across families, then degrade to lint-only
 *      (or a `STALE:`-tagged cached fallback). The floor always produces a report.
 *
 * The dispatch function is injected (pure + testable); the default binds to cascade-dispatch.
 */
'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;
// Freshness tiers (days): how long an AI claim of a given volatility stays actionable before it is
// demoted to informational; past 2× the tier it is dropped entirely (hard max-staleness).
const FRESHNESS_TIER_DAYS = { volatile: 3, standard: 7, durable: 14 };
const DEFAULT_TIER = 'standard';
const SEV_RANK = { high: 0, med: 1, low: 2, informational: 3 };
// A frontier claim (a speedup %, a new quant/format, an engine capability) must cite a source or be
// capped at informational. This matches the kinds of claims the AI layer exists to surface.
const FRONTIER_CLAIM_RE = /(\d+\s*[×x%]|speculative|quantiz|continuous batching|spec-decode|EAGLE|throughput)/i;

/** Resolve a freshness tier's window in ms (unknown tier → standard). */
function tierWindowMs(tier) {
  return (FRESHNESS_TIER_DAYS[tier] || FRESHNESS_TIER_DAYS[DEFAULT_TIER]) * DAY_MS;
}

/**
 * Compose the bounded research prompt from the lint report. Names the hardware + the flagged gaps and
 * asks for ranked, $0, current best-practice changes — flagging any hardware-spend item separately.
 */
function composeResearchPrompt(lintReport) {
  const findings = (lintReport.findings || []).map((f) => `- ${f.id} (${f.severity}): ${f.title}`).join('\n');
  const hosts = (lintReport.fingerprint && lintReport.fingerprint.hosts) || [];
  const hw = hosts.map((h) => `${h.engine}, VRAM=${h.vramBucket}`).join('; ') || 'no reachable host';
  return [
    `Fleet tier ${lintReport.tier}. Hardware: ${hw}.`,
    'Deterministic lint flagged:',
    findings || '- (no lint findings)',
    '',
    'List the current best-practice, $0 changes that maximize inference throughput and tool-use',
    'reliability, ranked by impact. For each: give the expected magnitude and a source link.',
    'Flag any change that requires hardware spend SEPARATELY. Be terse and concrete.',
  ].join('\n');
}

/**
 * Apply the trust controls to a raw AI finding, returning a normalized finding or null if it must be
 * dropped (past hard max-staleness). `now` is injected for determinism.
 */
function applyTrustControls(finding, now) {
  const tier = finding.freshness_tier || DEFAULT_TIER;
  const asOf = Date.parse(finding.as_of || '') || 0;
  const ageMs = asOf > 0 ? now - asOf : Infinity;
  const window = tierWindowMs(tier);

  // Hard max-staleness: past 2× the tier window a cached/old claim is dropped, never shown.
  if (ageMs > 2 * window) return null;

  const hasCitation = Boolean(finding.citation);
  const isFrontier = FRONTIER_CLAIM_RE.test(`${finding.title || ''} ${finding.recommendation || ''}`);
  const quantified = Boolean(finding.expectedGain);

  let severity = finding.severity && SEV_RANK[finding.severity] != null ? finding.severity : 'informational';
  let trust = 'high';
  const notes = [];

  // Citation-or-low-trust: an uncited frontier claim cannot rise above informational.
  if (isFrontier && !hasCitation) {
    trust = 'low';
    severity = 'informational';
    notes.push('uncited frontier claim → informational');
  }
  // Quantified-gain: a performance recommendation without a magnitude is capped at informational.
  if (isFrontier && !quantified) {
    severity = 'informational';
    notes.push('no quantified gain → informational');
  }
  // Freshness: past the tier window (but within 2×) the claim is demoted to informational + STALE-tagged.
  let title = finding.title || '';
  if (ageMs > window) {
    severity = 'informational';
    const ageDays = Number.isFinite(ageMs) ? Math.floor(ageMs / DAY_MS) : '∞';
    title = `STALE: ${title} (as_of ${ageDays}d old)`;
    notes.push('stale → informational');
  }
  return {
    id: finding.id || `AI-${(title || 'finding').slice(0, 24)}`,
    title,
    recommendation: finding.recommendation || '',
    severity,
    class: finding.class || 'informational',
    source: 'ai-research',
    as_of: finding.as_of || null,
    citation: finding.citation || null,
    expectedGain: finding.expectedGain || null,
    trust,
    trustNotes: notes,
  };
}

/**
 * Merge AI findings into the lint report under the lint-authoritative policy. A lint finding always
 * wins; an AI finding overlapping a lint rule folds in as supporting detail; an AI-only finding is
 * included but is NEVER auto-promoted to `high` (capped at `med`).
 */
function mergeFindings(lintReport, aiFindings) {
  const lint = (lintReport.findings || []).map((f) => ({ ...f }));
  const lintById = new Map(lint.map((f) => [f.id, f]));
  const merged = [...lint];
  for (const ai of aiFindings) {
    const overlap = lintById.get(ai.id);
    if (overlap) {
      overlap.aiSupport = ai.recommendation || ai.title;
      overlap.aiCitation = ai.citation || null;
      continue;
    }
    // AI-only: never auto-high — demote a claimed `high` to `med`.
    const severity = ai.severity === 'high' ? 'med' : ai.severity;
    merged.push({ ...ai, severity, aiOnly: true });
  }
  merged.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9) || String(a.id).localeCompare(String(b.id)));
  return merged;
}

/** Sleep helper (injected-clock friendly): resolves after ms; overridable for tests via opts.sleep. */
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run the AI pass. `dispatch(prompt)` must resolve to `{ findings: [...] }` (or throw on outage).
 * Bounded retry/backoff across attempts; on total failure, fall back to `opts.cachedFindings`
 * (STALE-tagged, subject to the same max-staleness drop) and finally to lint-only. Never throws.
 */
async function runAiPass(lintReport, opts = {}) {
  const now = typeof opts.now === 'number' ? opts.now : 0;
  const maxAttempts = opts.maxAttempts || 3;
  const sleep = opts.sleep || defaultSleep;
  const dispatch = opts.dispatch;

  let raw = null;
  let aiStatus = 'ok';
  if (typeof dispatch === 'function') {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await dispatch(composeResearchPrompt(lintReport), { attempt });
        raw = (result && Array.isArray(result.findings)) ? result.findings : [];
        break;
      } catch (err) {
        aiStatus = `retry:${err.message}`;
        if (attempt < maxAttempts) await sleep(opts.backoffMs ? opts.backoffMs * attempt : 0);
      }
    }
  } else {
    aiStatus = 'no-dispatch';
  }

  // Degrade path: use cached findings (STALE) when the live pass produced nothing.
  let usedCache = false;
  if (raw === null) {
    if (Array.isArray(opts.cachedFindings) && opts.cachedFindings.length) {
      raw = opts.cachedFindings;
      usedCache = true;
      aiStatus = 'unavailable-using-cache';
    } else {
      raw = [];
      aiStatus = aiStatus === 'ok' ? 'no-dispatch' : `unavailable:${aiStatus}`;
    }
  }

  const aiFindings = raw.map((f) => applyTrustControls(f, now)).filter(Boolean);
  return {
    ...lintReport,
    findings: mergeFindings(lintReport, aiFindings),
    aiPass: { status: usedCache ? 'stale-cache' : (aiFindings.length || aiStatus === 'ok' ? 'ok' : aiStatus), usedCache, aiFindingCount: aiFindings.length },
  };
}

module.exports = {
  runAiPass,
  composeResearchPrompt,
  applyTrustControls,
  mergeFindings,
  tierWindowMs,
  FRESHNESS_TIER_DAYS,
};
