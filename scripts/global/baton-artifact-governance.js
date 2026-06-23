'use strict';
// Baton artifact governance — validates baton artifacts on issue comments.
// C2 (#3030): validates last-of-each-type (matching per-role gate behavior);
// superseded bad artifacts become advisory, not blocking.

const { validateEntry, violation, EPIC_FORBIDDEN_ARTIFACTS } = require('./baton-entry-validator');

const ARTIFACT_ROLE = {
  MANAGER_HANDOFF: 'manager',
  COLLABORATOR_HANDOFF: 'collaborator',
  ADMIN_HANDOFF: 'admin',
  CONSULTANT_CLOSEOUT: 'consultant',
};

function isEpic(labels) {
  return (labels || []).some(name => String(name).toLowerCase() === 'type:epic');
}

// Line-anchored header match (#2564): avoid prose-mention misclassification.
function artifactHeaderRe(artifact) {
  return new RegExp(`(^|\\n)\\s*(?:\\*\\*|##\\s+)?${artifact}\\b`);
}

function entries(comments) {
  const out = [];
  for (let i = 0; i < (comments || []).length; i++) {
    const comment = comments[i];
    const body = String((comment && comment.body) || comment || '');
    for (const [artifact, role] of Object.entries(ARTIFACT_ROLE)) {
      if (artifactHeaderRe(artifact).test(body)) {
        out.push({ artifact, role, body, positionIndex: i });
      }
    }
  }
  return out;
}

// Return the last entry per artifact type (matches per-role gate behavior).
// Earlier entries of the same type are returned in .superseded for advisory use.
function latestOfEachType(allEntries) {
  const byType = {};
  for (const e of allEntries) {
    if (!byType[e.artifact]) byType[e.artifact] = [];
    byType[e.artifact].push(e);
  }
  const latest = [];
  const superseded = [];
  for (const [, group] of Object.entries(byType)) {
    latest.push(group[group.length - 1]);
    for (let i = 0; i < group.length - 1; i++) superseded.push(group[i]);
  }
  return { latest, superseded };
}

function analyzeComments(comments, opts = {}) {
  const allEntries = entries(comments);
  const linkedIsEpic = isEpic(opts.linkedIssueLabels);
  const { latest, superseded } = latestOfEachType(allEntries);
  const violations = [];
  const advisories = [];
  for (const entry of latest) {
    violations.push(...validateEntry(entry, linkedIsEpic, opts));
  }
  for (const entry of superseded) {
    const sv = validateEntry(entry, linkedIsEpic, opts);
    for (const viol of sv) {
      advisories.push({
        ...viol, severity: 'advisory',
        detail: `[superseded] ${viol.detail}`,
      });
    }
  }
  return {
    ok: violations.length === 0,
    count: allEntries.length,
    violations,
    advisories,
  };
}

module.exports = {
  entries, analyzeComments, latestOfEachType, ARTIFACT_ROLE,
  isEpic, EPIC_FORBIDDEN_ARTIFACTS, violation,
};
