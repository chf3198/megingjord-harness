'use strict';
// collaborator-handoff — validates COLLABORATOR_HANDOFF signer + content.
// Refs #2302: LIGHTWEIGHT imported from lane-enum.js (single source of truth).
// #2424: doc-coverage block now blocking (not advisory).
// #2439: cross_family_reviewer/rating/findings blocking; family independence check.

const path = require('path');
const { roleIdentity } = require(path.join(__dirname, '..', 'baton-independence.js'));
const { LIGHTWEIGHT, laneSeverity } = require(path.join(__dirname, '..', 'lane-enum.js'));
const docCoverage = require('./doc-coverage.js');
const { KNOWN_FAMILIES, extractAIFamily } = require('./signer-fidelity.js');

// #2562: accept string OR {body} comment elements so a caller passing bare
// bodies (the baton-gates.yml regression) cannot silently false-fail the gate.
const bodyOf = (c) => (typeof c === 'string' ? c : (c && c.body) || '');

function findCollaboratorHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?COLLABORATOR_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(bodyOf(c)));
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

function checkCrossFamily(body) {
  const violations = [];
  const block = s => ({ rule: `missing-${s}`, detail: `COLLABORATOR_HANDOFF missing ${s}: field` });
  if (!/cross_family_reviewer:/i.test(body)) violations.push(block('cross-family-reviewer'));
  if (!/cross_family_rating:/i.test(body)) violations.push(block('cross-family-rating'));
  if (!/cross_family_findings:/i.test(body)) violations.push(block('cross-family-findings'));
  const fm = (body || '').match(/reviewer_family\s*:\s*(\S+)/i);
  if (fm && !KNOWN_FAMILIES.includes(fm[1].toLowerCase())) {
    violations.push({ rule: 'unknown-reviewer-family',
      detail: `reviewer_family "${fm[1]}" not in KNOWN_FAMILIES`, severity: 'advisory' });
  }
  const tmm = (body || '').match(/Team&Model\s*:\s*(\S+)/i);
  const rvm = (body || '').match(/cross_family_reviewer\s*:\s*(\S+)/i);
  if (tmm && rvm) {
    const cf = extractAIFamily(tmm[1]);
    const rf = extractAIFamily(rvm[1]);
    if (cf !== 'unknown' && cf === rf) {
      violations.push({ rule: 'cross-family-reviewer-same-family',
        detail: `Reviewer family "${rf}" matches Collaborator Team&Model family` });
    }
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
  const body = bodyOf(handoff);
  const violations = checkSignerFields(body);
  if (input.lane === 'lane:code-change') {
    let matrix;
    try { matrix = docCoverage.loadMatrix(); } catch (_) { matrix = null; }
    if (matrix) violations.push(...docCoverage.checkBlock(body, input.labels || [], matrix));
  }
  if (input.lane === 'lane:code-change') {
    violations.push(...checkCrossFamily(body));
  }
  const signer = roleIdentity({ body, author: handoff.user && handoff.user.login });
  const blocking = violations.filter(v => v.severity !== 'advisory');
  return { ok: blocking.length === 0, violations, found: true, signer };
}

module.exports = { validate, findCollaboratorHandoff, LIGHTWEIGHT };
