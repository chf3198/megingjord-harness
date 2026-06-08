#!/usr/bin/env node
'use strict';
// tier: 1
// fleet-review-required (Epic #2192 / #2738): HARD-GATE that makes cross-family
// fleet/free-cloud review non-skippable at Consultant phase. Promotes the
// fleet-review contract from instruction (advisory) to enforcement (G1), and by
// mandating the free fleet/free-cloud lane it is the Epic's G3 payoff. Registered
// as an `enforced` link in config/governance-chains.yml (self-enforced by #2709's
// chain-integrity.js). 3-fact anti-forgery (Phase-0 #2193): cross-family +
// verdict-format + dispatch-provenance. Pure logic (unit-testable).

const LANES_REQUIRING_REVIEW = new Set(['area:governance', 'area:scripts', 'area:hooks']);
const REVIEWER_RE = /cross_family_reviewer:\s*([^\s@]+@[^\s]+)/i;
const VERDICT_RE = /cross_family_verdict:\s*(ACCEPT|PARTIAL|REJECT)\s*[-—–]+\s*\S+@\S+\s*[-—–]+\s*.+/i;

const FAMILY = [
  [/claude|opus|sonnet|haiku|anthropic/i, 'anthropic'],
  [/gpt|codex|openai/i, 'openai'],
  [/gemini|google/i, 'google'],
  [/qwen|alibaba/i, 'alibaba'],
  [/llama|meta/i, 'meta'],
  [/mistral|mixtral/i, 'mistral'],
];

function modelFamily(text) {
  const found = FAMILY.find(([re]) => re.test(String(text || '')));
  return found ? found[1] : 'unknown';
}

function laneRequiresReview(labels = []) {
  return (labels || []).some((label) => LANES_REQUIRING_REVIEW.has(label));
}

function validate(ctx = {}) {
  const violations = [];
  if (!laneRequiresReview(ctx.labels)) return { ok: true, violations };
  const body = String(ctx.closeoutBody || '');
  const reviewer = (body.match(REVIEWER_RE) || [])[1];
  if (!reviewer || !VERDICT_RE.test(body)) {
    violations.push({ rule: 'fleet-review-missing',
      detail: 'CONSULTANT_CLOSEOUT on a review-required lane must carry cross_family_reviewer + '
        + 'cross_family_verdict (ACCEPT|PARTIAL|REJECT - model@host - rationale)' });
    return { ok: false, violations };
  }
  // fact 1 - cross-family: reviewer family must differ from the author's family
  const authorFamily = modelFamily(ctx.authorTeamModel);
  const reviewerFamily = modelFamily(reviewer);
  if (reviewerFamily === 'unknown' || reviewerFamily === authorFamily) {
    violations.push({ rule: 'fleet-review-not-cross-family',
      detail: `reviewer family '${reviewerFamily}' must differ from author family '${authorFamily}' (no same-family self-review)` });
  }
  // fact 3 - dispatch provenance: the CI caller injects whether a real dispatch was recorded
  if (ctx.dispatchRecorded === false) {
    violations.push({ rule: 'fleet-review-no-dispatch-record',
      detail: 'no HAMR/fleet/free-cloud dispatch record found for the claimed review (forgery guard)' });
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { validate, modelFamily, laneRequiresReview, LANES_REQUIRING_REVIEW };

if (require.main === module) {
  console.log('fleet-review-required: validator module (invoked by CI with closeout context)');
}
