// terminal-reconciler.js — Reconcile closed issues against baton trail completeness.
// Pure logic; IO injected via githubClient + incidentWriter. Refs #3291, Epic #3284.
'use strict';

const CLOSEOUT_PATTERN = /^##\s*CONSULTANT_CLOSEOUT/m;
const EPIC_CLOSEOUT_PATTERN = /^##\s*CONSULTANT_EPIC_CLOSEOUT/m;
const CANCELLATION_PATTERN = /^CANCELLATION:\s/m;
const BATCH_EVIDENCE_PATTERN = /resolved as part of batch with #\d+/i;

const DISPOSITION_LABELS = Object.freeze([
  'resolution:released',
  'resolution:cancelled',
  'resolution:duplicate',
  'resolution:wontfix',
  'governance:close-without-merge',
]);

/**
 * Check whether any comment contains a valid closeout artifact.
 * @param {Array<{body: string}>} comments - Issue comments.
 * @returns {boolean} True if a closeout artifact is present.
 */
function hasCloseoutArtifact(comments) {
  for (const comment of comments) {
    const body = comment.body || '';
    if (CLOSEOUT_PATTERN.test(body)) return true;
    if (EPIC_CLOSEOUT_PATTERN.test(body)) return true;
    if (CANCELLATION_PATTERN.test(body)) return true;
    if (BATCH_EVIDENCE_PATTERN.test(body)) return true;
  }
  return false;
}

/**
 * Check whether the issue has a recorded disposition label.
 * @param {Array<string>} labels - Label names on the issue.
 * @returns {boolean} True if a disposition label is present.
 */
function hasDispositionLabel(labels) {
  return labels.some((label) => DISPOSITION_LABELS.includes(label));
}

/**
 * Reconcile a closed issue: decide REVERT or ACCEPT.
 * @param {{number: number, title: string, state: string, labels: string[]}} issue
 * @param {Array<{body: string}>} comments - Comments on the issue.
 * @returns {{decision: string, reason: string, issue: number}}
 */
function deriveDecision(issue, comments) {
  const trailComplete = hasCloseoutArtifact(comments);
  const dispositioned = hasDispositionLabel(issue.labels);
  if (trailComplete || dispositioned) {
    const reason = trailComplete ? 'closeout-artifact-present' : 'disposition-label-present';
    return { decision: 'ACCEPT', reason, issue: issue.number };
  }
  return {
    decision: 'REVERT',
    reason: 'incomplete-trail-no-disposition',
    issue: issue.number,
  };
}

/** Build the owner-ping comment body for a reverted close. */
function buildRevertPingBody() {
  return [
    '## governance:close-reverted',
    '',
    'This issue was closed without a CONSULTANT_CLOSEOUT, CANCELLATION,',
    'batch-evidence, or disposition label. Reopened by the terminal reconciler.',
    'The baton owner must post the required artifact before re-closing.',
    '',
    'Refs #3291, Epic #3284.',
  ].join('\n');
}

/** Emit a revert incident to the incident writer. */
function emitRevertIncident(incidentWriter, issueNumber) {
  if (!incidentWriter) return;
  incidentWriter.append({
    ts: new Date().toISOString(),
    version: 3,
    service: 'baton-fsm-reconciler',
    env: 'local',
    event: 'terminal-reconciler-revert',
    pattern_id: 'force-close-without-closeout',
    issue: issueNumber,
    severity: 'medium',
  });
}

/**
 * Execute a reconcile decision against the GitHub client.
 * @param {{number: number, title: string, state: string, labels: string[]}} issue
 * @param {object} githubClient
 * @param {object} incidentWriter - {append(event)}
 * @returns {Promise<{decision: string, reason: string, issue: number, applied: boolean}>}
 */
async function reconcileClose(issue, githubClient, incidentWriter) {
  const comments = await githubClient.listComments(issue.number);
  const result = deriveDecision(issue, comments);
  if (result.decision === 'ACCEPT') {
    return { ...result, applied: false };
  }
  await githubClient.reopenIssue(issue.number);
  await githubClient.addLabel(issue.number, 'governance:close-reverted');
  await githubClient.comment(issue.number, buildRevertPingBody());
  emitRevertIncident(incidentWriter, issue.number);
  return { ...result, applied: true };
}

module.exports = {
  reconcileClose,
  deriveDecision,
  hasCloseoutArtifact,
  hasDispositionLabel,
  DISPOSITION_LABELS,
};
