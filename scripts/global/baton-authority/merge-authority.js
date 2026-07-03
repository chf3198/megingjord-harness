// merge-authority.js -- Server-authoritative merge evaluator.
// AC1: only GitHub-derived facts authorize merge (never local cache).
// AC3: digest mismatch rejects spoofed evidence.
// Refs #3290, Epic #3284.
'use strict';

const { deriveTrailFromGitHub, buildEvidenceMask } = require('./evidence-loader');
const { verifyDigest } = require('./merkle');
const { STATES, EVENTS } = require('../baton-fsm/transitions');
const kernel = require('../baton-fsm/kernel');

const FSM_VERSION = '1.0.0';
const MERGE_AUTHORITY_VERSION = '1.0.0';
const BREAK_GLASS_LABEL = 'merge-bypass:admin-exception';
const BYPASS_REASON_PATTERN = /bypass_reason\s*:/i;
const APPROVER_PATTERN = /approver\s*:/i;
const EVIDENCE_BIT_COUNT = 11;

/**
 * Check whether the break-glass bypass is validly activated.
 * Requires the label AND a recorded approver in issue comments.
 */
function checkBreakGlass(labels, comments) {
  if (!labels.includes(BREAK_GLASS_LABEL)) return false;
  for (const comment of (comments || [])) {
    const body = comment.body || '';
    if (BYPASS_REASON_PATTERN.test(body) && APPROVER_PATTERN.test(body)) {
      return true;
    }
  }
  return false;
}

/**
 * Build a denial result with structured metadata.
 */
function buildDenial(reason, missing, trailFacts) {
  return {
    allowed: false,
    reason,
    missing: missing || [],
    fsm_version: FSM_VERSION,
    authority_version: MERGE_AUTHORITY_VERSION,
    trail_facts: trailFacts || null,
  };
}

/**
 * Build an approval result with structured metadata.
 */
function buildApproval(trailFacts, digestUsed) {
  return {
    allowed: true,
    reason: 'all-evidence-present-and-verified',
    missing: [],
    fsm_version: FSM_VERSION,
    authority_version: MERGE_AUTHORITY_VERSION,
    trail_facts: trailFacts,
    evidence_digest: digestUsed,
  };
}

/**
 * Identify which evidence bits are missing from the mask.
 * Returns an array of human-readable names.
 */
function identifyMissingEvidence(mask, requiredMask) {
  const missing = [];
  const bitNames = {
    0: 'MANAGER_HANDOFF',
    1: 'COLLABORATOR_HANDOFF',
    2: 'ADMIN_HANDOFF',
    3: 'CONSULTANT_CLOSEOUT',
    4: 'ALL_ACS_PASS',
    5: 'SIGNER_INDEPENDENT',
    6: 'CI_GREEN',
    7: 'PR_MERGED',
    8: 'WORKTREE_MERGE_OK',
    9: 'DISPOSITION_RECORDED',
    10: 'BATON_BACK_REASON',
  };
  for (let bitIdx = 0; bitIdx < EVIDENCE_BIT_COUNT; bitIdx++) {
    const bitVal = 1 << bitIdx;
    const isRequired = (requiredMask & bitVal) !== 0;
    const isPresent = (mask & bitVal) !== 0;
    if (isRequired && !isPresent) {
      missing.push(bitNames[bitIdx] || ('BIT_' + bitIdx));
    }
  }
  return missing;
}

/**
 * Enrich facts with PR merge state from the ghClient.
 * Mutates facts in place; failures are non-fatal.
 */
async function enrichWithPRData(facts, prNumber, ghClient) {
  if (!prNumber) return;
  if (ghClient.getPR) {
    try {
      const prData = await ghClient.getPR(prNumber);
      if (prData) facts.prMerged = Boolean(prData.merged);
    } catch (_ignored) { /* PR fetch failure is non-fatal */ }
  }
  if (ghClient.listChecks) {
    try {
      const checks = await ghClient.listChecks(prNumber);
      if (checks && Array.isArray(checks)) {
        const hasChecks = checks.length !== 0;
        const allPassed = hasChecks && checks.every(
          (chk) => chk.conclusion === 'success'
        );
        if (allPassed) facts.ciGreen = true;
      }
    } catch (_ignored) { /* Checks fetch failure is non-fatal */ }
  }
}

/**
 * Evaluate whether a merge is authorized for a given issue+PR.
 *
 * Server-authoritative: loads trail from GitHub, verifies digest,
 * runs FSM kernel. Local admin_ops can NEVER make allowed=true.
 *
 * @param {number} issueNumber - The linked GitHub issue number.
 * @param {number} prNumber - The PR number.
 * @param {object} ghClient - Injected GitHub client interface.
 * @param {string} claimedDigest - Agent-submitted evidence digest.
 * @returns {Promise<object>} Structured merge authority result.
 */
async function evaluateMergeAuthority(issueNumber, prNumber, ghClient, claimedDigest) {
  let trail;
  try {
    trail = await deriveTrailFromGitHub(issueNumber, ghClient);
  } catch (loadError) {
    return buildDenial(
      'github-load-failed: ' + (loadError.message || 'unknown'),
      ['GITHUB_TRAIL'], null
    );
  }
  if (trail.error) {
    return buildDenial('trail-error: ' + trail.error, ['GITHUB_TRAIL'], null);
  }
  const facts = trail.facts;
  await enrichWithPRData(facts, prNumber, ghClient);
  const mask = buildEvidenceMask(facts);
  // Verify digest integrity (AC3)
  const digestResult = verifyDigest(facts, claimedDigest);
  if (!digestResult.valid) {
    const comments = await ghClient.listComments(issueNumber).catch(() => []);
    const breakGlassActive = checkBreakGlass(trail.labels || [], comments);
    if (breakGlassActive) {
      return {
        allowed: true,
        reason: 'break-glass-bypass-activated',
        missing: [],
        fsm_version: FSM_VERSION,
        authority_version: MERGE_AUTHORITY_VERSION,
        break_glass: true,
        trail_facts: facts,
      };
    }
    return buildDenial(
      'digest-verification-failed: ' + digestResult.reason,
      ['EVIDENCE_DIGEST'], facts
    );
  }
  // Run FSM kernel for MERGE event
  const stateCode = STATES[facts.state] !== undefined
    ? STATES[facts.state] : STATES.TESTING;
  const packed = kernel.decide(stateCode, EVENTS.MERGE, mask);
  const unpacked = kernel.unpack(packed);
  if (unpacked.decisionName === 'allow') {
    return buildApproval(facts, claimedDigest);
  }
  const { findTransition } = require('../baton-fsm/transitions');
  const transition = findTransition(stateCode, EVENTS.MERGE);
  const requiredMask = transition ? transition.requiredMask : 0;
  const missingNames = identifyMissingEvidence(mask, requiredMask);
  // #3532: when independence is the blocker, name WHY (team-split w/o valid receipt)
  // so the denial is actionable rather than an opaque missing-bit.
  let reason = 'fsm-denied: ' + unpacked.reasonName;
  if (missingNames.includes('SIGNER_INDEPENDENT')) {
    reason += ' (signer-independence: ' + (facts.signerIndependenceBasis || 'unknown')
      + '; requires a different signing TEAM or a verified cross-family consensus receipt)';
  }
  return buildDenial(reason, missingNames, facts);
}

module.exports = {
  evaluateMergeAuthority,
  checkBreakGlass,
  buildDenial,
  buildApproval,
  identifyMissingEvidence,
  MERGE_AUTHORITY_VERSION,
  BREAK_GLASS_LABEL,
};
