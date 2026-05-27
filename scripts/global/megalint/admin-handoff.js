'use strict';
// admin-handoff — validates ADMIN_HANDOFF signer + independence vs Collaborator.

const path = require('path');
const { roleIdentity } = require(path.join(__dirname, '..', 'baton-independence.js'));

const LIGHTWEIGHT = ['lane:docs-research', 'lane:docs-only', 'lane:trivial'];

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
  if (!/Signed-by:/i.test(body)) violations.push({ rule: 'missing-signer', detail: 'ADMIN_HANDOFF missing Signed-by field' });
  if (!/Team&Model:/i.test(body)) violations.push({ rule: 'missing-team-model', detail: 'ADMIN_HANDOFF missing Team&Model field' });
  if (!/Role:\s*admin/i.test(body)) violations.push({ rule: 'missing-role-admin', detail: 'ADMIN_HANDOFF missing Role: admin field' });
  return violations;
}

function checkIndependence(adminBody, collaboratorHandoff) {
  if (!collaboratorHandoff) return [];
  const collabName = nameOnly(collaboratorHandoff.body);
  const adminName = nameOnly(adminBody);
  if (collabName && adminName && collabName === adminName) {
    return [{ rule: 'admin-signer-not-independent',
      detail: `ADMIN_HANDOFF signer "${adminName}" matches COLLABORATOR_HANDOFF signer — independent verification requires a distinct identity` }];
  }
  return [];
}

function validate(input) {
  if (LIGHTWEIGHT.includes(input.lane)) {
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
  const signer = roleIdentity({ body: handoff.body, author: handoff.user && handoff.user.login });
  return { ok: violations.length === 0, violations, found: true, signer };
}

module.exports = { validate, findAdminHandoff, LIGHTWEIGHT };
