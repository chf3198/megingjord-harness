'use strict';

const { extractArtifactFields, validateArtifactAlias } = require('./megalint/signer-registry-check');

const ARTIFACT_ROLE = {
  MANAGER_HANDOFF: 'manager',
  COLLABORATOR_HANDOFF: 'collaborator',
  ADMIN_HANDOFF: 'admin',
  CONSULTANT_CLOSEOUT: 'consultant',
};

// Epic-shape contract (Rule E2 v2): Epic-typed issues only carry MANAGER_HANDOFF
// + CONSULTANT_CLOSEOUT (the latter only during status:review). ADMIN/COLLAB
// artifacts on an Epic are violations — the orchestrator-worker contract puts
// those phases on the CHILDREN. Closes the Epic-#1857 violation class.
const EPIC_FORBIDDEN_ARTIFACTS = ['ADMIN_HANDOFF', 'COLLABORATOR_HANDOFF'];

function isEpic(labels) {
  return (labels || []).some(name => String(name).toLowerCase() === 'type:epic');
}

function roleFromBody(body) {
  return extractArtifactFields(body).role;
}

// Line-anchored header match, mirroring the canonical per-validator finders
// (megalint/manager-handoff.js, collaborator-handoff.js). A bare body.includes()
// over-matches when one artifact mentions a sibling token in prose (#2564),
// misclassifying it and tripping a false artifact-role-mismatch.
function artifactHeaderRe(artifact) {
  return new RegExp(`(^|\\n)\\s*(?:\\*\\*|##\\s+)?${artifact}\\b`);
}

function entries(comments) {
  const out = [];
  for (const c of comments || []) {
    const body = String((c && c.body) || c || '');
    for (const [artifact, role] of Object.entries(ARTIFACT_ROLE)) {
      if (artifactHeaderRe(artifact).test(body)) out.push({ artifact, role, body });
    }
  }
  return out;
}

function fixable(rule) {
  return [
    'artifact-role-mismatch',
    'signer-alias-not-registry-derived',
    'signer-fields-invalid',
    'mixed-semantic-role-fields',
  ].includes(rule);
}

function violation(artifact, rule, detail) {
  const v = { artifact, rule, detail };
  if (fixable(rule)) {
    v.remediation = {
      mode: 'source-edit-first',
      suggestedFix: 'Edit the offending issue comment/artifact in place, then rerun consultant checks. Use additive audit comments only when the source artifact cannot be edited.',
    };
  }
  return v;
}

function analyzeComments(comments, opts = {}) {
  const violations = [];
  const linkedIsEpic = isEpic(opts.linkedIssueLabels);
  for (const entry of entries(comments)) {
    if (linkedIsEpic && EPIC_FORBIDDEN_ARTIFACTS.includes(entry.artifact)) {
      violations.push({ artifact: entry.artifact, rule: 'epic-shape-forbidden-artifact',
        detail: `${entry.artifact} forbidden on type:epic per Rule E2 v2. ` +
          `Epic only carries MANAGER_HANDOFF (lifecycle) + CONSULTANT_CLOSEOUT (status:review). ` +
          `${entry.artifact === 'ADMIN_HANDOFF' ? 'Admin' : 'Collaborator'} phase belongs on CHILD tickets.` });
      continue;
    }
    const actualRole = roleFromBody(entry.body);
    if (!actualRole || actualRole !== entry.role) {
      violations.push(violation(entry.artifact, 'artifact-role-mismatch',
        `Expected Role: ${entry.role} for ${entry.artifact}.`));
    }
    const alias = validateArtifactAlias(entry.body, opts);
    if (alias.ok) continue;
    if (alias.violation) violations.push(violation(entry.artifact,
      alias.violation.rule, alias.violation.detail));
    else violations.push(violation(entry.artifact, 'signer-fields-invalid',
      alias.skipped || 'invalid signer fields'));
  }
  return { ok: violations.length === 0, count: entries(comments).length, violations };
}

module.exports = { analyzeComments, ARTIFACT_ROLE, isEpic, EPIC_FORBIDDEN_ARTIFACTS, violation };
