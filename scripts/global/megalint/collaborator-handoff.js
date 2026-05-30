'use strict';
// collaborator-handoff — validates COLLABORATOR_HANDOFF signer + content.
// Refs #2302: LIGHTWEIGHT imported from lane-enum.js (single source of truth).
// #2424: doc-coverage block now blocking (not advisory).

const path = require('path');
const { roleIdentity } = require(path.join(__dirname, '..', 'baton-independence.js'));
const { LIGHTWEIGHT, laneSeverity } = require(path.join(__dirname, '..', 'lane-enum.js'));
const docCoverage = require('./doc-coverage.js');

function findCollaboratorHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?COLLABORATOR_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
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
  const body = handoff.body || '';
  const violations = checkSignerFields(body);
  if (input.lane === 'lane:code-change' && process.env.DOC_COVERAGE_GATE_ADVISORY !== '1') {
    let matrix;
    try { matrix = docCoverage.loadMatrix(); } catch (_) { matrix = null; }
    if (matrix) violations.push(...docCoverage.checkBlock(body, input.labels || [], matrix));
  }
  const signer = roleIdentity({ body, author: handoff.user && handoff.user.login });
  return { ok: violations.length === 0, violations, found: true, signer };
}

module.exports = { validate, findCollaboratorHandoff, LIGHTWEIGHT };
