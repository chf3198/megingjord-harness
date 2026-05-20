'use strict';
// label-lint-close-protection — pure decision logic for the auto-transition
// vs auto-reopen branch of label-lint.yml. Extracted so the race condition
// fix (#1515) is unit-testable without a live GitHub API.
//
// Decision rules:
// 1. If issue is open or already terminal → no-op.
// 2. If issue closed without a terminal label AND a CONSULTANT_CLOSEOUT
//    comment exists AND the pre-close status is `status:review` OR
//    `status:testing` (the two states the baton produces just before close):
//      → auto-transition to status:done + resolution:completed.
// 3. Otherwise (closed without terminal, no closeout in trail) → reopen
//    and post the "Close blocked" advisory.
//
// Pre-fix: rule 2 required `status:review` ONLY, missing the merge-via-
// `Closes #N`-trailer path that fires at `status:testing`. Caused
// reopen-on-merge friction across #1506/#1508/#1512.

const CLOSEOUT_HEADER_RE = /(^|\n)\s*(?:\*\*|##\s+)?CONSULTANT_CLOSEOUT(?:_EPIC_CLOSEOUT)?\b/;
const TERMINAL_LABELS = ['status:done', 'status:cancelled'];
const VALID_PRE_CLOSE_LABELS = ['status:review', 'status:testing'];

function hasCloseoutComment(comments) {
  return (comments || []).some((c) => CLOSEOUT_HEADER_RE.test((c && c.body) || ''));
}

function decide({ state, labels = [], comments = [] }) {
  if (state !== 'closed') return { action: 'noop', reason: 'issue-open' };
  if (labels.some((l) => TERMINAL_LABELS.includes(l))) {
    return { action: 'noop', reason: 'already-terminal' };
  }
  const closeoutPresent = hasCloseoutComment(comments);
  const preCloseLabel = VALID_PRE_CLOSE_LABELS.find((l) => labels.includes(l));
  if (closeoutPresent && preCloseLabel) {
    // #1380: strip ALL status:* labels (not just preCloseLabel) to prevent
    // Rule 1 multi-status drift when a stale label like status:backlog lingers.
    const allStatusLabels = labels.filter(l => l.startsWith('status:'));
    return {
      action: 'auto-transition',
      from: preCloseLabel,
      removeLabels: [...allStatusLabels, 'role:consultant'],
      addLabels: ['status:done', 'resolution:completed'],
      reason: `closeout-present-from-${preCloseLabel}`,
    };
  }
  return {
    action: 'reopen',
    reason: closeoutPresent ? 'closeout-without-valid-pre-close-label' : 'no-closeout-in-trail',
  };
}

module.exports = {
  decide, hasCloseoutComment,
  CLOSEOUT_HEADER_RE, TERMINAL_LABELS, VALID_PRE_CLOSE_LABELS,
};
