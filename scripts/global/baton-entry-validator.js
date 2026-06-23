'use strict';
// Extracted from baton-artifact-governance.js to stay ≤100 lines.
// Validates a single baton entry for role-mismatch and signer checks.

const { extractArtifactFields, validateArtifactAlias } = require('./megalint/signer-registry-check');

const EPIC_FORBIDDEN_ARTIFACTS = ['ADMIN_HANDOFF', 'COLLABORATOR_HANDOFF'];

function roleFromBody(body) {
  return extractArtifactFields(body).role;
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
  const viol = { artifact, rule, detail };
  if (fixable(rule)) {
    viol.remediation = {
      mode: 'source-edit-first',
      suggestedFix: 'Edit the offending issue comment/artifact in place, '
        + 'then rerun consultant checks. Use additive audit comments '
        + 'only when the source artifact cannot be edited.',
    };
  }
  return viol;
}

function checkAlias(entry, opts) {
  const alias = validateArtifactAlias(entry.body, opts);
  if (alias.ok) return [];
  if (alias.violation) {
    return [violation(
      entry.artifact, alias.violation.rule, alias.violation.detail
    )];
  }
  return [violation(
    entry.artifact, 'signer-fields-invalid',
    alias.skipped || 'invalid signer fields'
  )];
}

function validateEntry(entry, linkedIsEpic, opts) {
  if (linkedIsEpic && EPIC_FORBIDDEN_ARTIFACTS.includes(entry.artifact)) {
    return [{
      artifact: entry.artifact,
      rule: 'epic-shape-forbidden-artifact',
      detail: `${entry.artifact} forbidden on type:epic per Rule E2 v2. `
        + 'Epic only carries MANAGER_HANDOFF (lifecycle) + '
        + 'CONSULTANT_CLOSEOUT (status:review). '
        + `${entry.artifact === 'ADMIN_HANDOFF' ? 'Admin' : 'Collaborator'}`
        + ' phase belongs on CHILD tickets.',
    }];
  }
  const violations = [];
  const actualRole = roleFromBody(entry.body);
  if (!actualRole || actualRole !== entry.role) {
    violations.push(violation(
      entry.artifact, 'artifact-role-mismatch',
      `Expected Role: ${entry.role} for ${entry.artifact}.`
    ));
  }
  return violations.concat(checkAlias(entry, opts));
}

module.exports = { validateEntry, violation, EPIC_FORBIDDEN_ARTIFACTS };
