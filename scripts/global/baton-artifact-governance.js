'use strict';

const { validateArtifactAlias } = require('./megalint/signer-registry-check');

const ARTIFACT_ROLE = {
  MANAGER_HANDOFF: 'manager',
  COLLABORATOR_HANDOFF: 'collaborator',
  ADMIN_HANDOFF: 'admin',
  CONSULTANT_CLOSEOUT: 'consultant',
};

function roleFromBody(body) {
  const m = String(body || '').match(/Role\s*:\s*(\w+)/i);
  return m ? m[1].toLowerCase() : null;
}

function entries(comments) {
  const out = [];
  for (const c of comments || []) {
    const body = String((c && c.body) || c || '');
    for (const [artifact, role] of Object.entries(ARTIFACT_ROLE)) {
      if (body.includes(artifact)) out.push({ artifact, role, body });
    }
  }
  return out;
}

function analyzeComments(comments, opts = {}) {
  const violations = [];
  for (const entry of entries(comments)) {
    const actualRole = roleFromBody(entry.body);
    if (!actualRole || actualRole !== entry.role) {
      violations.push({
        artifact: entry.artifact,
        rule: 'artifact-role-mismatch',
        detail: `Expected Role: ${entry.role} for ${entry.artifact}.`,
      });
    }
    const alias = validateArtifactAlias(entry.body, opts);
    if (alias.ok) continue;
    if (alias.violation) violations.push({ artifact: entry.artifact, ...alias.violation });
    else violations.push({ artifact: entry.artifact, rule: 'signer-fields-invalid', detail: alias.skipped || 'invalid signer fields' });
  }
  return { ok: violations.length === 0, count: entries(comments).length, violations };
}

module.exports = { analyzeComments, ARTIFACT_ROLE };