'use strict';
// work-log-sync-helpers.js — parsing helpers for work-log-sync validator (#3199).
// Extracted per 100-line design contract. Pure functions, no I/O except fs.read.

const fs = require('node:fs');
const path = require('node:path');

const HANDOFF_TYPES = [
  'MANAGER_HANDOFF', 'COLLABORATOR_HANDOFF',
  'ADMIN_HANDOFF', 'CONSULTANT_CLOSEOUT',
];
const HANDOFF_RE = /(?:^|\n)\s*(?:#{1,3}\s+\d+\.\s+)?(?:#{1,3}\s+)?(MANAGER_HANDOFF|COLLABORATOR_HANDOFF|ADMIN_HANDOFF|CONSULTANT_CLOSEOUT)\b/g;

/** Resolve path to wiki/work-log/tickets/<N>.md; null if absent. */
function resolveWorkLogPath(ticketNum, root) {
  const p = path.join(root, 'wiki', 'work-log', 'tickets', `${ticketNum}.md`);
  return fs.existsSync(p) ? p : null;
}

/** Parse local work-log and extract declared handoff block types. */
function parseLocalHandoffs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const blocks = [];
  const seen = new Set();
  let match;
  while ((match = HANDOFF_RE.exec(content)) !== null) {
    const type = match[1];
    if (!seen.has(type)) { seen.add(type); blocks.push({ type }); }
  }
  return blocks;
}

/** Determine lifecycle phase for validation scoping. */
function currentPhase(prExists, issueState) {
  if (issueState === 'CLOSED' || issueState === 'closed') return 'post-merge';
  if (prExists) return 'post-pr';
  return 'pre-pr';
}

/** Return handoff types required to be synced at a given phase. */
function requiredForPhase(phase) {
  if (phase === 'pre-pr') {
    return ['MANAGER_HANDOFF', 'COLLABORATOR_HANDOFF'];
  }
  if (phase === 'post-pr') {
    return ['MANAGER_HANDOFF', 'COLLABORATOR_HANDOFF', 'ADMIN_HANDOFF'];
  }
  return HANDOFF_TYPES; // post-merge: all required
}

/** Check if any remote comment contains the handoff artifact header. */
function commentContainsHandoff(comments, handoffType) {
  const anchoredRe = new RegExp(
    `(?:^|\\n)\\s*(?:#{1,3}\\s+)?${handoffType}\\b`, 'i');
  return comments.some(body => anchoredRe.test(body));
}

module.exports = {
  resolveWorkLogPath, parseLocalHandoffs, currentPhase,
  requiredForPhase, commentContainsHandoff, HANDOFF_TYPES, HANDOFF_RE,
};
