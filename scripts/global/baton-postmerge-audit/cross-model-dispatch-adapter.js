'use strict';
// cross-model-dispatch-adapter.js (Epic #3251 #3258 D6): operationalizes the
// post-merge-audit Layer-B dispatch. It REPLACES the prior inert placeholder
// (`() => ({verdict:'ACCEPT', findings:[]})`) with a real cross-model review that
// composes the shipped pieces via `cross-model-review-dispatch#dispatchReview`,
// then maps its output to the auditor's `{verdict, score, reviewer_model_family,
// findings}` contract. Fully degradation-safe: any failure resolves to an
// advisory programmatic-only ACCEPT so the advisory workflow never fails (G6).
const { teamToFamily } = require('./family-registry');

// Map a dispatchReview envelope to the post-merge-auditor dispatch contract.
function mapToAudit(out = {}) {
  const markers = (out.route && out.route.markers) || out.findings || [];
  const findings = markers.map((m) =>
    `${m.remediator || '?'}:${m.impact || '?'} ${m.finding_ref || ''}`.trim());
  const coverage = out.review_coverage || 'programmatic-only';
  const programmatic = coverage === 'programmatic-only';
  const reviewerFamily = (out.reviewer && out.reviewer.family)
    || (programmatic ? 'programmatic-only' : 'unknown');
  const verdict = findings.length ? 'REJECT' : 'ACCEPT';
  const score = programmatic ? 5 : (findings.length ? 4 : 8);
  return { verdict, score, reviewer_model_family: reviewerFamily, findings,
    review_coverage: coverage, escalate_client_uat: Boolean(out.escalate_client_uat) };
}

// Build the `dispatch(prompt, ctx)` fn the workflow passes to runPostMergeAudit.
// `deps.dispatchReview` is injectable for tests; production lazily loads the real
// composed pipeline so a missing/broken module degrades (never throws to the run).
function makeCrossModelDispatch(deps = {}) {
  return async function dispatch(prompt, ctx = {}) {
    try {
      const dispatchReview = deps.dispatchReview
        || require('../cross-model-review-dispatch').dispatchReview;
      const authorFamily = ctx.authorTeam ? teamToFamily(ctx.authorTeam) : 'anthropic';
      const out = await dispatchReview({ prompt, authorFamily, deps: deps.reviewDeps });
      return mapToAudit(out);
    } catch (err) {
      return { verdict: 'ACCEPT', score: 5, reviewer_model_family: 'programmatic-only',
        findings: [], review_coverage: 'programmatic-only', degraded_reason: String(err && err.message) };
    }
  };
}

module.exports = { makeCrossModelDispatch, mapToAudit };
