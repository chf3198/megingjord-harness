'use strict';
// tier3-escalation.js — opens a Tier-3 escalation ticket to the Manager
// when a post-merge consultant audit fails. NEVER blocks merge (merge
// already happened). Refs #3293, Epic #3284.

const AUDIT_FAIL_THRESHOLD = 5;

const TIER3_LABELS = [
  'type:bug', 'priority:P2', 'area:governance',
  'lane:code-change', 'anneal:tier-3',
];

/** Format the PR reference string. */
function formatPrRef(mergedPr) {
  return mergedPr.number ? `#${mergedPr.number}` : (mergedPr.url || 'unknown');
}

/** Format the findings list as indented lines. */
function formatFindings(findings) {
  if (!Array.isArray(findings) || findings.length === 0) {
    return '  (no structured findings)';
  }
  return findings.map(
    (finding, idx) => `  ${idx + 1}. ${finding}`
  ).join('\n');
}

/** Build the body for a Tier-3 escalation ticket. */
function buildEscalationBody(auditResult, mergedPr) {
  const prRef = formatPrRef(mergedPr);
  const score = auditResult.score != null ? String(auditResult.score) : 'N/A';
  const reviewerFamily = auditResult.reviewer_model_family || 'unknown';
  return [
    '## Tier-3 anneal: post-merge consultant audit failure',
    '',
    `Merged PR: ${prRef}`,
    `Audit verdict: ${auditResult.verdict}`,
    `Audit score: ${score}`,
    `Reviewer model family: ${reviewerFamily}`,
    '', 'Findings:', formatFindings(auditResult.findings),
    '',
    'Per Epic #3284 plane separation: the deterministic FSM is the',
    'only blocking authority. This is post-merge advisory. The Manager',
    'must triage whether the findings warrant a follow-up fix.',
    '', 'Refs #3293',
  ].join('\n');
}

/** Determine whether the audit result warrants escalation. */
function shouldEscalate(auditResult) {
  if (!auditResult) return false;
  const verdict = String(auditResult.verdict || '').toUpperCase();
  if (verdict === 'REJECT') return true;
  if (auditResult.score != null
    && auditResult.score < AUDIT_FAIL_THRESHOLD) return true;
  return false;
}

/**
 * Open a Tier-3 escalation ticket when the audit fails.
 * ghClient: { createIssue({ title, body, labels }) }
 * A passing audit is a no-op.
 */
async function escalateOnAuditFailure(auditResult, mergedPr, ghClient) {
  if (!shouldEscalate(auditResult)) {
    return { escalated: false, reason: 'audit-passed' };
  }
  const prRef = formatPrRef(mergedPr);
  const title = `Tier-3 anneal: post-merge audit failure on ${prRef} (verdict=${auditResult.verdict})`;
  const body = buildEscalationBody(auditResult, mergedPr);
  const issue = await ghClient.createIssue({
    title, body, labels: TIER3_LABELS,
  });
  return { escalated: true, issue };
}

module.exports = {
  escalateOnAuditFailure,
  shouldEscalate,
  buildEscalationBody,
  formatPrRef,
  formatFindings,
  TIER3_LABELS,
  AUDIT_FAIL_THRESHOLD,
};
