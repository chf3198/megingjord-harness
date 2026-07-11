'use strict';
// #3053: merge-before-handoff predicate for lane:code-change.
// When PR is (a) CI-green, (b) admin_review_rating >= 93, yet NOT merged
// → violation. Genuinely RED CI is NEVER flagged (no forced bypass).
// Reuses EVIDENCE_BITS from baton-fsm/transitions + signal patterns from
// evidence-loader for offline-graceful degradation.
// #3055: admin_review_rating field parsing.

const path = require('path');
const { EVIDENCE_BITS } = require(path.join(__dirname, '..', 'baton-fsm', 'transitions'));
const { extractSignalsFromComment } = require(path.join(__dirname, '..', 'baton-authority', 'evidence-loader'));

const RATING_RE = /admin_review_rating\s*:\s*(\d+)/i;
const RATING_THRESHOLD = 93;

/** Parse admin_review_rating from an ADMIN_HANDOFF comment body. */
function parseRating(body) {
  const m = (body || '').match(RATING_RE);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Derive CI-green and PR-merged facts from input.
 * Accepts pre-derived input.facts (from evidence-loader) or scans comments.
 * Returns { ciGreen: bool|null, prMerged: bool|null }.
 */
function deriveFacts(input, adminBody) {
  const facts = input.facts || {};
  let ciGreen = facts.ciGreen != null ? facts.ciGreen : null;
  let prMerged = facts.prMerged != null ? facts.prMerged : null;
  // Fallback: scan comment signals when facts not provided
  if (ciGreen == null) {
    for (const comment of (input.comments || [])) {
      const sig = extractSignalsFromComment(comment.body || '');
      if (sig.CI_GREEN) { ciGreen = true; break; }
    }
  }
  return { ciGreen, prMerged };
}

/**
 * Check merge-before-handoff precondition.
 * Returns array of violation objects (empty = pass).
 *
 * Offline-graceful: when merge/CI facts unavailable → severity:'advisory'.
 * When facts ARE present and predicate holds → BLOCKING.
 * Red CI → never flagged (the authoritative CI gate blocks).
 */
function checkMergePrecondition(adminBody, input) {
  const rating = parseRating(adminBody);
  if (rating == null || rating < RATING_THRESHOLD) return [];
  const { ciGreen, prMerged } = deriveFacts(input, adminBody);
  // Red CI → NEVER flagged (no forced bypass).
  if (ciGreen === false) return [];
  // BLOCKING only when merge-state is DEFINITIVELY known: CI green AND confirmed
  // unmerged (explicit facts). This is the stop-hook / post-merge-audit path.
  if (ciGreen === true && prMerged === false) {
    return [{ rule: 'admin-handoff-without-merge',
      detail: `PR is CI-green and admin_review_rating=${rating} (>=${RATING_THRESHOLD}) but NOT merged. Admin must merge before ADMIN_HANDOFF.` }];
  }
  // Offline-graceful: rating>=93 but merge/CI state not both-known (the pre-merge
  // posting-time validator, GitHub unreachable) → ADVISORY, never a merge deadlock.
  // The authoritative blocking enforcement is the stop-hook merge coupling (#3054).
  if (prMerged !== true) {
    return [{ rule: 'admin-handoff-without-merge', severity: 'advisory',
      detail: `admin_review_rating=${rating} (>=${RATING_THRESHOLD}); merge/CI state not definitively known at posting time — advisory (stop-hook enforces merge-before-handoff)` }];
  }
  return [];
}

module.exports = { checkMergePrecondition, parseRating, deriveFacts, RATING_THRESHOLD };
