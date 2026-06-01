'use strict';
// admin-handoff — validates ADMIN_HANDOFF signer + independence vs Collaborator.
// Refs #2302: LIGHTWEIGHT imported from lane-enum.js (single source of truth).
// Updated to include lane:config-only and lane:research (were missing vs canonical set).

const path = require('path');
const { roleIdentity } = require(path.join(__dirname, '..', 'baton-independence.js'));
const { LIGHTWEIGHT, laneSeverity } = require(path.join(__dirname, '..', 'lane-enum.js'));

function findAdminHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?ADMIN_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
}

function findCollaboratorHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?COLLABORATOR_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
}

function nameOnly(commentBody) {
  const match = (commentBody || '').match(/Signed-by\s*:\s*([^·,\n]+?)(?=\s*[·,\n]|$)/i);
  return match ? match[1].trim().toLowerCase() : null;
}

function checkSignerFields(body) {
  const violations = [];
  if (!/Signed-by:/i.test(body)) {
    violations.push({ rule: 'missing-signer', detail: 'ADMIN_HANDOFF missing Signed-by field' });
  }
  if (!/Team&Model:/i.test(body)) {
    violations.push({ rule: 'missing-team-model', detail: 'ADMIN_HANDOFF missing Team&Model field' });
  }
  if (!/Role:\s*admin/i.test(body)) {
    violations.push({ rule: 'missing-role-admin', detail: 'ADMIN_HANDOFF missing Role: admin field' });
  }
  return violations;
}

function checkIndependence(adminBody, collaboratorHandoff) {
  if (!collaboratorHandoff) return [];
  const collabName = nameOnly(collaboratorHandoff.body);
  const adminName = nameOnly(adminBody);
  if (collabName && adminName && collabName === adminName) {
    return [{ rule: 'admin-signer-not-independent',
      detail: `ADMIN_HANDOFF signer "${adminName}" matches COLLABORATOR_HANDOFF signer`
        + ` — independent verification requires a distinct identity` }];
  }
  return [];
}

function checkCrossFamily(body) {
  if (!/reviewer_family_verified:/i.test(body)) {
    return [{ rule: 'missing-reviewer-family-verified',
      detail: 'ADMIN_HANDOFF missing reviewer_family_verified: field', severity: 'advisory' }];
  }
  return [];
}

function validate(input) {
  if (LIGHTWEIGHT.includes(input.lane) || laneSeverity(input.lane) === 'issue-only') {
    return { ok: true, violations: [], reason: 'lightweight-lane-skip' };
  }
  const comments = input.comments || [];
  const handoff = findAdminHandoff(comments);
  if (!handoff) {
    return { ok: false, violations: [{ rule: 'missing-admin-handoff',
      detail: 'ADMIN_HANDOFF comment not found on issue' }], found: false };
  }
  const violations = [
    ...checkSignerFields(handoff.body || ''),
    ...checkIndependence(handoff.body, findCollaboratorHandoff(comments)),
  ];
  if (input.lane === 'lane:code-change') {
    violations.push(...checkCrossFamily(handoff.body || ''));
  }
  const signer = roleIdentity({ body: handoff.body, author: handoff.user && handoff.user.login });
  return { ok: violations.length === 0, violations, found: true, signer };
}

module.exports = { validate, findAdminHandoff, LIGHTWEIGHT };
