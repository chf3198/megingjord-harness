// grammar.js — Normalization grammar for baton-artifact text.
// Fail-closed: anything outside the grammar returns {ok: false}. Refs #3287, Epic #3284.
'use strict';

const { EVIDENCE_BITS } = require('./transitions');

// Each rule maps a regex pattern on artifact text to an evidence bit.
// Rules are applied in order; a single artifact may match multiple rules.
const GRAMMAR_RULES = Object.freeze([
  {
    name: 'manager_handoff',
    pattern: /## MANAGER_HANDOFF\b/,
    bit: EVIDENCE_BITS.MANAGER_HANDOFF,
    description: 'MANAGER_HANDOFF artifact header detected',
  },
  {
    name: 'collaborator_handoff',
    pattern: /## COLLABORATOR_HANDOFF\b/,
    bit: EVIDENCE_BITS.COLLABORATOR_HANDOFF,
    description: 'COLLABORATOR_HANDOFF artifact header detected',
  },
  {
    name: 'admin_handoff',
    pattern: /## ADMIN_HANDOFF\b/,
    bit: EVIDENCE_BITS.ADMIN_HANDOFF,
    description: 'ADMIN_HANDOFF artifact header detected',
  },
  {
    name: 'consultant_closeout',
    pattern: /## CONSULTANT_CLOSEOUT\b/,
    bit: EVIDENCE_BITS.CONSULTANT_CLOSEOUT,
    description: 'CONSULTANT_CLOSEOUT artifact header detected',
  },
  {
    name: 'all_acs_pass',
    pattern: /(?:all\s+acs?\s+(?:verified\s+)?pass|AC\d+[:\s]+.*?PASS)/i,
    bit: EVIDENCE_BITS.ALL_ACS_PASS,
    description: 'All acceptance criteria verified PASS',
  },
  {
    name: 'signer_independent',
    pattern: /signer[_-]independence[_-]check:\s*PASS/i,
    bit: EVIDENCE_BITS.SIGNER_INDEPENDENT,
    description: 'Admin/Collaborator signer independence verified',
  },
  {
    name: 'ci_green',
    pattern: /(?:CI[:\s]+(?:all\s+)?(?:green|pass)|checks?[:\s]+(?:all\s+)?(?:green|pass))/i,
    bit: EVIDENCE_BITS.CI_GREEN,
    description: 'CI checks all green/passing',
  },
  {
    name: 'pr_merged',
    pattern: /(?:PR\s+(?:#\d+\s+)?merged|merge[d]?\s+(?:via|by|at|on)\b)/i,
    bit: EVIDENCE_BITS.PR_MERGED,
    description: 'Pull request merged',
  },
  {
    name: 'worktree_merge_ok',
    pattern: /worktree[_-]merge[_-](?:ok|clean|pass)/i,
    bit: EVIDENCE_BITS.WORKTREE_MERGE_OK,
    description: 'Worktree merge precondition satisfied (#3051)',
  },
  {
    name: 'disposition_recorded',
    pattern: /(?:CANCELLATION:\s*\S|disposition[:\s]+recorded)/i,
    bit: EVIDENCE_BITS.DISPOSITION_RECORDED,
    description: 'Cancellation disposition recorded',
  },
  {
    name: 'baton_back_reason',
    pattern: /baton[_-]back[_-]reason:\s*\S/i,
    bit: EVIDENCE_BITS.BATON_BACK_REASON,
    description: 'Baton-back reason provided (#3251)',
  },
]);

const GRAMMAR_VERSION = '1.0.0';

/**
 * Canonicalize artifact text into evidence tokens.
 * FAIL-CLOSED: returns {ok: false} if text is empty or non-string.
 * @param {string} artifactText - Raw baton-artifact text.
 * @returns {{tokens: Array<{name: string, bit: number}>, mask: number, ok: boolean}}
 */
function canonicalize(artifactText) {
  if (!artifactText || typeof artifactText !== 'string') {
    return { tokens: [], mask: 0, ok: false, reason: 'empty-or-non-string-input' };
  }
  const trimmed = artifactText.trim();
  if (trimmed.length === 0) {
    return { tokens: [], mask: 0, ok: false, reason: 'empty-after-trim' };
  }
  const tokens = [];
  let mask = 0;
  for (const rule of GRAMMAR_RULES) {
    if (rule.pattern.test(trimmed)) {
      tokens.push({ name: rule.name, bit: rule.bit, description: rule.description });
      mask |= rule.bit;
    }
  }
  if (tokens.length === 0) {
    return { tokens: [], mask: 0, ok: false, reason: 'no-recognized-tokens' };
  }
  return { tokens, mask, ok: true };
}

module.exports = {
  canonicalize,
  GRAMMAR_RULES,
  GRAMMAR_VERSION,
};
