'use strict';
// collaborator-handoff — validates COLLABORATOR_HANDOFF signer + content.
// Refs #2302: LIGHTWEIGHT imported from lane-enum.js (single source of truth).
// Updated to include lane:research (was missing vs canonical set).

const path = require('path');
const { roleIdentity } = require(path.join(__dirname, '..', 'baton-independence.js'));
const { LIGHTWEIGHT, laneSeverity } = require(path.join(__dirname, '..', 'lane-enum.js'));

function findCollaboratorHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?COLLABORATOR_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
}

const DOC_COVERAGE_RE = /(^|\n)\s*doc-coverage\s*:/i;

function checkDocCoverageAdvisory(body, lane) {
  // Refs Epic #2148 / #2154 - Tech-Writer sub-phase advisory
  if (lane !== 'lane:code-change') return [];
  if (DOC_COVERAGE_RE.test(body)) return [];
  return [{ rule: 'doc-coverage-advisory', severity: 'advisory',
    detail: 'COLLABORATOR_HANDOFF lacks doc-coverage block (Tech-Writer sub-phase advisory per Epic #2148).' }];
}

function checkSignerFields(body) {
  const violations = [];
  if (!/Signed-by:/i.test(body)) {
    violations.push({ rule: 'missing-signer',
      detail: 'COLLABORATOR_HANDOFF missing Signed-by field' });
  }
  if (!/Team&Model:/i.test(body)) {
    violations.push({ rule: 'missing-team-model',
      detail: 'COLLABORATOR_HANDOFF missing Team&Model field' });
  }
  if (!/Role:\s*collaborator/i.test(body)) {
    violations.push({ rule: 'missing-role-collaborator',
      detail: 'COLLABORATOR_HANDOFF missing Role: collaborator field' });
  }
  return violations;
}

function validate(input) {
  if (LIGHTWEIGHT.includes(input.lane) || laneSeverity(input.lane) === 'issue-only') {
    return { ok: true, violations: [], reason: 'lightweight-lane-skip' };
  }
  const handoff = findCollaboratorHandoff(input.comments || []);
  if (!handoff) {
    return { ok: false, violations: [{ rule: 'missing-collaborator-handoff',
      detail: 'COLLABORATOR_HANDOFF comment not found on issue' }], found: false };
  }
  const violations = checkSignerFields(handoff.body || '');
  const advisory = checkDocCoverageAdvisory(handoff.body || '', input.lane);
  const signer = roleIdentity({ body: handoff.body, author: handoff.user && handoff.user.login });
  return { ok: violations.length === 0, violations, advisory, found: true, signer };
}

module.exports = { validate, findCollaboratorHandoff, checkDocCoverageAdvisory, LIGHTWEIGHT };
