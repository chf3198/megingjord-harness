'use strict';
// post-merge-auditor.js — cross-model audit of a merged change (ADVISORY,
// NEVER blocks merge). Refs #3293, Epic #3284. Plane separation: the
// deterministic FSM (W1a/W2) is the sole blocking authority; this LLM
// Consultant is post-merge inference/advice.

const { assertCrossFamily, teamToFamily } = require('./family-registry');
const { escalateOnAuditFailure, shouldEscalate } = require('./tier3-escalation');

/** Extract team name from "team:model@substrate" -> "team". */
function parseAuthorTeam(authorTeamModel) {
  if (!authorTeamModel || typeof authorTeamModel !== 'string') return null;
  const colonIdx = authorTeamModel.indexOf(':');
  if (colonIdx === -1) return authorTeamModel.trim();
  return authorTeamModel.slice(0, colonIdx).trim();
}

/** Build the prompt for the cross-model audit dispatch. */
function buildAuditPrompt(mergedPr) {
  const title = mergedPr.title || 'untitled';
  const prNum = mergedPr.number || 'unknown';
  const diff = mergedPr.diff || '(no diff available)';
  return [
    `Review this merged PR #${prNum}: "${title}".`,
    'Evaluate for correctness, security, and governance.',
    'Return a structured verdict (ACCEPT or REJECT),',
    'a numeric score (1-10), and specific findings.',
    '', 'Diff:', diff,
  ].join('\n');
}

/** Check cross-family invariant; return violation result or null. */
function checkFamilyViolation(authorTeam, reviewerFamily) {
  if (!authorTeam || !reviewerFamily) return null;
  if (assertCrossFamily(authorTeam, reviewerFamily)) return null;
  const ownFamily = teamToFamily(authorTeam);
  return {
    verdict: 'FAMILY_VIOLATION', score: null,
    reviewer_model_family: reviewerFamily,
    findings: [
      'Cross-family invariant violated: reviewer family'
      + ` "${reviewerFamily}" matches author team`
      + ` "${authorTeam}" (family: ${ownFamily})`,
    ],
    familyViolation: true,
  };
}

/** Build a normalized audit envelope from dispatch output. */
function buildAuditEnvelope(auditResult) {
  return {
    verdict: auditResult.verdict || 'UNKNOWN',
    score: auditResult.score != null ? auditResult.score : null,
    reviewer_model_family: auditResult.reviewer_model_family || 'unknown',
    findings: auditResult.findings || [],
    familyViolation: false,
  };
}

/**
 * Run the post-merge consultant audit.
 * mergeBlocking is ALWAYS false — this is advisory only.
 */
async function runPostMergeAudit(mergedPr, opts = {}) {
  const { dispatch, ghClient, authorTeamModel } = opts;
  if (!dispatch) throw new Error('runPostMergeAudit: dispatch is required');
  if (!mergedPr) throw new Error('runPostMergeAudit: mergedPr is required');
  const authorTeam = parseAuthorTeam(authorTeamModel);
  const prompt = buildAuditPrompt(mergedPr);
  const raw = await dispatch(prompt, { taskClass: 'post-merge-audit', authorTeam });
  const violation = checkFamilyViolation(authorTeam, raw.reviewer_model_family);
  if (violation) return { audit: violation, escalation: null, mergeBlocking: false };
  const audit = buildAuditEnvelope(raw);
  let escalation = null;
  if (ghClient && shouldEscalate(audit)) {
    escalation = await escalateOnAuditFailure(audit, mergedPr, ghClient);
  }
  return { audit, escalation, mergeBlocking: false };
}

module.exports = {
  runPostMergeAudit,
  parseAuthorTeam,
  buildAuditPrompt,
  checkFamilyViolation,
  buildAuditEnvelope,
};
