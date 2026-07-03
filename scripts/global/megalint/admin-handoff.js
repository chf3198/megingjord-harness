'use strict';
// admin-handoff — validates ADMIN_HANDOFF signer + independence vs Collaborator.
// Refs #2302: LIGHTWEIGHT imported from lane-enum.js (single source of truth).
// Updated to include lane:config-only and lane:research (were missing vs canonical set).
// #2510: cross-family independence check using COLLABORATOR_HANDOFF fields.

const path = require('path');
const { roleIdentity, checkAdminIndependence } = require(path.join(__dirname, '..', 'baton-independence.js'));
const { LIGHTWEIGHT, laneSeverity } = require(path.join(__dirname, '..', 'lane-enum.js'));
const { extractAIFamily } = require('./signer-fidelity.js');
const wtGate = require('../worktree-lifecycle-gate');

function findAdminHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?ADMIN_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
}

function findCollaboratorHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?COLLABORATOR_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
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

// #3532: independence is now delegated to the single source of truth
// (baton-independence.checkAdminIndependence) — Team&Model TEAM segment OR a
// VERIFIED cross-family consensus receipt. Persona-surname comparison is retired.
// When a receipt is present but this posting-time validator lacks issue context
// to verify it against the ledger, the finding is advisory — the authoritative
// baton-authority/merge + consensus-receipt-check CI gates (which have the issue
// number) do the blocking verification. A same-team split with NO receipt is a
// hard block here too (the #3518/#3521 loophole case).
function checkIndependence(comments, issueNumber) {
  const res = checkAdminIndependence(comments, { issueNumber });
  if (res.ok) return [];
  const receiptPresent = res.receiptReason && res.receiptReason !== 'no-receipt';
  const violation = { rule: 'admin-signer-not-independent', detail: res.message || res.reason };
  if (receiptPresent && issueNumber == null) violation.severity = 'advisory';
  return [violation];
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
    ...checkIndependence(comments, input.issueNumber),
  ];
  if (input.lane === 'lane:code-change') {
    violations.push(...checkCrossFamily(handoff.body || '', collabHandoff));
    violations.push(...wtGate.checkAdmin(handoff.body || '', input));
  }
  const signer = roleIdentity({ body: handoff.body, author: handoff.user && handoff.user.login });
  const blocking = violations.filter(v => v.severity !== 'advisory');
  return { ok: blocking.length === 0, violations, found: true, signer };
}

module.exports = { validate, findAdminHandoff, LIGHTWEIGHT };
