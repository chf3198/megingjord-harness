// evidence-loader.js -- Derives baton trail PURELY from GitHub truth.
// Ignores all local admin_ops cache. Refs #3290, Epic #3284.
// AC1/AC3: only GitHub-derived facts can authorize merge.
'use strict';

const { EVIDENCE_BITS } = require('../baton-fsm/transitions');
// #3532: team-segment + verified cross-family consensus receipt decide independence.
const { teamSegmentOf, familyOfModel, verifyReceipt, RECEIPT_FIELD_RE } = require('../cross-family-receipt');
const RECEIPT_RE = RECEIPT_FIELD_RE;

// Artifact header patterns (mirrors grammar.js canonical patterns)
const ARTIFACT_HEADERS = Object.freeze({
  MANAGER_HANDOFF: /## MANAGER_HANDOFF\b/,
  COLLABORATOR_HANDOFF: /## COLLABORATOR_HANDOFF\b/,
  ADMIN_HANDOFF: /## ADMIN_HANDOFF\b/,
  CONSULTANT_CLOSEOUT: /## CONSULTANT_CLOSEOUT\b/,
});

// Evidence signal patterns from baton artifact bodies
const SIGNAL_PATTERNS = Object.freeze({
  ALL_ACS_PASS: /(?:all\s+acs?\s+(?:verified\s+)?pass|AC\d+[:\s]+.*?PASS)/i,
  SIGNER_INDEPENDENT: /signer[_-]independence[_-]check:\s*PASS/i,
  CI_GREEN: /(?:CI[:\s]+(?:all\s+)?(?:green|pass)|checks?[:\s]+(?:all\s+)?(?:green|pass))/i,
  WORKTREE_MERGE_OK: /worktree[_-]merge[_-](?:ok|clean|pass)/i,
  DISPOSITION_RECORDED: /(?:CANCELLATION:\s*\S|disposition[:\s]+recorded)/i,
  BATON_BACK_REASON: /baton[_-]back[_-]reason:\s*\S/i,
});

/**
 * Extract baton artifact presence from a single comment body.
 * Returns an object with boolean flags for each artifact found.
 */
function extractArtifactsFromComment(body) {
  const found = {};
  for (const [name, pattern] of Object.entries(ARTIFACT_HEADERS)) {
    if (pattern.test(body)) found[name] = true;
  }
  return found;
}

/**
 * Extract evidence signals from a single comment body.
 * Returns an object with boolean flags for each signal found.
 */
function extractSignalsFromComment(body) {
  const found = {};
  for (const [name, pattern] of Object.entries(SIGNAL_PATTERNS)) {
    if (pattern.test(body)) found[name] = true;
  }
  return found;
}

/**
 * Extract signer aliases from a comment body.
 * Returns array of {role, signedBy, teamModel} objects.
 */
function extractSigners(body) {
  const signers = [];
  const roleMatch = body.match(/Role:\s*(manager|collaborator|admin|consultant)/i);
  const signedByMatch = body.match(/Signed-by:\s*(.+)/i);
  const teamModelMatch = body.match(/Team&Model:\s*(.+)/i);
  if (roleMatch && signedByMatch) {
    signers.push({
      role: roleMatch[1].toLowerCase(),
      signedBy: signedByMatch[1].trim(),
      teamModel: teamModelMatch ? teamModelMatch[1].trim() : null,
    });
  }
  return signers;
}

/**
 * Derive the current FSM state code from GitHub issue labels.
 * Returns a state string matching STATES keys.
 */
function deriveStateFromLabels(labels) {
  const statusLabels = labels.filter(
    (label) => label.startsWith('status:')
  );
  if (statusLabels.length === 0) return null;
  // Use the first status label (single-status invariant)
  const statusValue = statusLabels[0].replace('status:', '');
  return statusValue.replace(/-/g, '_').toUpperCase();
}

/**
 * Check signer independence via Team&Model TEAM segment (#3532).
 * Persona-surname difference is NO LONGER independence. Returns true only when
 * both signers exist AND sign under genuinely different teams. The cross-family
 * consensus-receipt path is layered on separately in deriveTrailFromGitHub.
 */
function checkSignerIndependence(commentSigners) {
  let collab = null;
  let admin = null;
  for (const entry of commentSigners) {
    if (entry.role === 'collaborator') collab = entry;
    if (entry.role === 'admin') admin = entry;
  }
  if (!collab || !admin) return false;
  const collabTeam = teamSegmentOf(collab.teamModel);
  const adminTeam = teamSegmentOf(admin.teamModel);
  if (!collabTeam || !adminTeam) return false;
  return collabTeam !== adminTeam;
}

/**
 * Resolve the cross-family consensus receipt cited in the ADMIN_HANDOFF, if any.
 * Returns the 16-hex receipt string or null.
 */
function extractMergeReceipt(comments) {
  const admin = [...(comments || [])].reverse().find(
    (c) => /ADMIN_HANDOFF/.test(c.body || '') && RECEIPT_RE.test(c.body || '')
  );
  return admin ? (admin.body.match(RECEIPT_RE) || [])[1] : null;
}

/**
 * Build the evidence bitmask from GitHub-derived facts.
 * Pure function: no IO, no local cache.
 */
function buildEvidenceMask(facts) {
  let mask = 0;
  if (facts.hasManagerHandoff) mask |= EVIDENCE_BITS.MANAGER_HANDOFF;
  if (facts.hasCollaboratorHandoff) mask |= EVIDENCE_BITS.COLLABORATOR_HANDOFF;
  if (facts.hasAdminHandoff) mask |= EVIDENCE_BITS.ADMIN_HANDOFF;
  if (facts.hasConsultantCloseout) mask |= EVIDENCE_BITS.CONSULTANT_CLOSEOUT;
  if (facts.allAcsPass) mask |= EVIDENCE_BITS.ALL_ACS_PASS;
  if (facts.signerIndependent) mask |= EVIDENCE_BITS.SIGNER_INDEPENDENT;
  if (facts.ciGreen) mask |= EVIDENCE_BITS.CI_GREEN;
  if (facts.prMerged) mask |= EVIDENCE_BITS.PR_MERGED;
  if (facts.worktreeMergeOk) mask |= EVIDENCE_BITS.WORKTREE_MERGE_OK;
  if (facts.dispositionRecorded) mask |= EVIDENCE_BITS.DISPOSITION_RECORDED;
  if (facts.batonBackReason) mask |= EVIDENCE_BITS.BATON_BACK_REASON;
  return mask;
}

/**
 * Derive the complete baton trail from GitHub API data.
 * ghClient interface: { getIssue, listComments, getPR, listChecks }
 * Returns { facts, mask, state, labels, signers, error? }
 */
async function deriveTrailFromGitHub(issueNumber, ghClient, opts = {}) {
  const issue = await ghClient.getIssue(issueNumber);
  if (!issue) {
    return { facts: null, mask: 0, state: null, error: 'issue-not-found' };
  }
  const labels = (issue.labels || []).map(
    (labelObj) => typeof labelObj === 'string' ? labelObj : labelObj.name
  );
  const state = deriveStateFromLabels(labels);
  const comments = await ghClient.listComments(issueNumber);
  // Scan all comments for artifacts and signals
  const artifacts = {};
  const signals = {};
  const allSigners = [];
  for (const comment of (comments || [])) {
    const body = comment.body || '';
    const foundArtifacts = extractArtifactsFromComment(body);
    Object.assign(artifacts, foundArtifacts);
    const foundSignals = extractSignalsFromComment(body);
    Object.assign(signals, foundSignals);
    const signers = extractSigners(body);
    allSigners.push(...signers);
  }
  // #3532: independence = different team (a) OR a VERIFIED cross-family receipt (b).
  const teamIndependent = checkSignerIndependence(allSigners);
  const crossFamilyReceipt = extractMergeReceipt(comments);
  let signerIndependent = teamIndependent;
  let receiptStatus = teamIndependent ? 'independent-team' : 'no-receipt';
  if (!teamIndependent && crossFamilyReceipt) {
    const adminSigner = allSigners.find((s) => s.role === 'admin');
    const authoringFamily = familyOfModel(adminSigner && adminSigner.teamModel);
    const verify = opts.verifyReceipt || verifyReceipt;
    const res = verify(issueNumber, crossFamilyReceipt, authoringFamily,
      { kind: 'merge-consensus', ledger: opts.ledger });
    signerIndependent = res.ok;
    receiptStatus = res.reason;
  }
  // Build facts from GitHub-derived data only
  const facts = {
    issueNumber,
    issueState: issue.state || 'unknown',
    hasManagerHandoff: Boolean(artifacts.MANAGER_HANDOFF),
    hasCollaboratorHandoff: Boolean(artifacts.COLLABORATOR_HANDOFF),
    hasAdminHandoff: Boolean(artifacts.ADMIN_HANDOFF),
    hasConsultantCloseout: Boolean(artifacts.CONSULTANT_CLOSEOUT),
    allAcsPass: Boolean(signals.ALL_ACS_PASS),
    signerIndependent,
    signerIndependenceBasis: receiptStatus,
    crossFamilyReceipt: crossFamilyReceipt || null,
    ciGreen: Boolean(signals.CI_GREEN),
    prMerged: false,
    worktreeMergeOk: Boolean(signals.WORKTREE_MERGE_OK),
    dispositionRecorded: Boolean(signals.DISPOSITION_RECORDED),
    batonBackReason: Boolean(signals.BATON_BACK_REASON),
    labels,
    state,
  };
  return { facts, mask: buildEvidenceMask(facts), state, labels, signers: allSigners };
}

module.exports = {
  deriveTrailFromGitHub,
  buildEvidenceMask,
  extractArtifactsFromComment,
  extractSignalsFromComment,
  extractSigners,
  deriveStateFromLabels,
  checkSignerIndependence,
  extractMergeReceipt,
};
