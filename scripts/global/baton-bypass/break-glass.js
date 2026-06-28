// break-glass.js -- Break-glass emergency bypass with two-approver rule.
// Refs #3292, Epic #3284 (W4). AC2: two distinct approvers + hash-linked.
'use strict';

const MINIMUM_APPROVALS = 2;

/**
 * Record a break-glass entry requiring TWO distinct PR-review approvals.
 * Appends to the W1a Ed25519 hash chain via injected chainAppend.
 * @param {number} prNumber - The PR number requesting break-glass.
 * @param {Array<{alias:string}>} approvals - List of approval objects with alias.
 * @param {function} chainAppend - Injected function matching event-log.js appendVerdict signature.
 * @returns {{recorded:boolean, entry:object|null, error:string|null}}
 */
function recordBreakGlass(prNumber, approvals, chainAppend) {
  const uniqueApprovers = extractUniqueApprovers(approvals);
  if (uniqueApprovers.length < MINIMUM_APPROVALS) {
    return {
      recorded: false,
      entry: null,
      error: 'break-glass requires at least '
        + String(MINIMUM_APPROVALS)
        + ' distinct approver aliases; got '
        + String(uniqueApprovers.length),
    };
  }
  const verdict = {
    type: 'break-glass',
    pr: prNumber,
    approvers: uniqueApprovers,
    approver_count: uniqueApprovers.length,
  };
  const chainResult = chainAppend(verdict);
  return {
    recorded: true,
    entry: Object.assign({}, verdict, chainResult),
    error: null,
  };
}

/**
 * Extract unique approver aliases from an approvals list.
 * @param {Array<{alias:string}>} approvals
 * @returns {string[]} Deduplicated sorted alias list.
 */
function extractUniqueApprovers(approvals) {
  if (!Array.isArray(approvals)) return [];
  const seen = new Set();
  const unique = [];
  for (const approval of approvals) {
    const alias = (approval && approval.alias) ? approval.alias.trim() : '';
    if (alias && !seen.has(alias)) {
      seen.add(alias);
      unique.push(alias);
    }
  }
  return unique.sort();
}

/**
 * Verify a break-glass entry: two distinct approvers + valid chain linkage.
 * @param {object} entry - The break-glass log entry to verify.
 * @param {Array<object>} chain - The full chain of log entries for context.
 * @returns {{valid:boolean, errors:string[]}}
 */
function verifyBreakGlass(entry, chain) {
  const errors = [];
  if (!entry || entry.type !== 'break-glass') {
    errors.push('entry is not a break-glass record');
    return { valid: false, errors };
  }
  if (!Array.isArray(entry.approvers) || entry.approvers.length < MINIMUM_APPROVALS) {
    errors.push(
      'insufficient distinct approvers: need at least '
      + String(MINIMUM_APPROVALS)
    );
  }
  if (Array.isArray(chain) && chain.length > 0) {
    const entryInChain = chain.find(
      function findEntry(item) { return item.seq === entry.seq; }
    );
    if (!entryInChain) {
      errors.push('entry not found in chain');
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Pre-receive check: reject a push circumventing required checks
 * unless a valid recorded break-glass entry exists.
 * Pure function: push context and chain entries passed in.
 * @param {{checksOverridden:boolean, prNumber:number}} pushContext
 * @param {Array<object>} chainEntries - All break-glass chain entries.
 * @returns {{allowed:boolean, reason:string}}
 */
function preReceiveCheck(pushContext, chainEntries) {
  if (!pushContext || !pushContext.checksOverridden) {
    return { allowed: true, reason: 'no checks overridden' };
  }
  const prNum = pushContext.prNumber;
  const validEntry = (chainEntries || []).find(
    function matchPr(item) {
      const verdict = item.verdict || item;
      return verdict.type === 'break-glass' && verdict.pr === prNum;
    }
  );
  if (!validEntry) {
    return {
      allowed: false,
      reason: 'push circumvents required checks without a valid break-glass entry for PR #' + String(prNum),
    };
  }
  const verdict = validEntry.verdict || validEntry;
  if (!Array.isArray(verdict.approvers) || verdict.approvers.length < MINIMUM_APPROVALS) {
    return {
      allowed: false,
      reason: 'break-glass entry for PR #' + String(prNum)
        + ' has insufficient distinct approvers',
    };
  }
  return { allowed: true, reason: 'valid break-glass entry found for PR #' + String(prNum) };
}

module.exports = {
  recordBreakGlass,
  verifyBreakGlass,
  preReceiveCheck,
  extractUniqueApprovers,
  MINIMUM_APPROVALS,
};
