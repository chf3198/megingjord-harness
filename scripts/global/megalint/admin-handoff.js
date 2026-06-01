'use strict';
// admin-handoff — validates ADMIN_HANDOFF signer + independence vs Collaborator.
// Refs #2302: LIGHTWEIGHT imported from lane-enum.js (single source of truth).
// Updated to include lane:config-only and lane:research (were missing vs canonical set).
// #2510: cross-family independence check using COLLABORATOR_HANDOFF fields.

const path = require('path');
const { roleIdentity } = require(path.join(__dirname, '..', 'baton-independence.js'));
const { LIGHTWEIGHT, laneSeverity } = require(path.join(__dirname, '..', 'lane-enum.js'));
const { extractAIFamily } = require('./signer-fidelity.js');

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

function checkCrossFamily(adminBody, collaboratorHandoff) {
  const advisory = process.env.CROSS_FAMILY_ADMIN_GATE_ADVISORY === '1';
  const violations = [];
  if (!/reviewer_family_verified:/i.test(adminBody)) {
    violations.push({ rule: 'missing-reviewer-family-verified',
      detail: 'ADMIN_HANDOFF missing reviewer_family_verified: field', severity: 'advisory' });
  }
  if (!collaboratorHandoff) return violations;
  const cb = collaboratorHandoff.body || '';
  const tmm = cb.match(/Team&Model\s*:\s*(\S+)/i);
  const rvm = cb.match(/cross_family_reviewer\s*:\s*(\S+)/i);
  if (tmm && rvm) {
    const cf = extractAIFamily(tmm[1]);
    const rf = extractAIFamily(rvm[1]);
    if (cf !== 'unknown' && cf === rf) {
      const v = { rule: 'cross-family-reviewer-same-family',
        detail: `Reviewer family "${rf}" matches Collaborator Team&Model family` };
      if (advisory) v.severity = 'advisory';
      violations.push(v);
    }
  }
  return violations;
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
  const collabHandoff = findCollaboratorHandoff(comments);
  const violations = [
    ...checkSignerFields(handoff.body || ''),
    ...checkIndependence(handoff.body, collabHandoff),
  ];
  if (input.lane === 'lane:code-change') {
    violations.push(...checkCrossFamily(handoff.body || '', collabHandoff));
  }
  const signer = roleIdentity({ body: handoff.body, author: handoff.user && handoff.user.login });
  const blocking = violations.filter(v => v.severity !== 'advisory');
  return { ok: blocking.length === 0, violations, found: true, signer };
}

module.exports = { validate, findAdminHandoff, LIGHTWEIGHT };
