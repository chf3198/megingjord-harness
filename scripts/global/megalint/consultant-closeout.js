'use strict';
// consultant-closeout — validates CONSULTANT_CLOSEOUT schema.
// Epic #1407 AC7: requires verification-timestamp + G1-9 rubric atop signer fields.

function findConsultantCloseout(comments) {
  return (comments || []).reverse().find(c => (c.body || '').includes('CONSULTANT_CLOSEOUT'));
}

function checkSignerFields(body) {
  const violations = [];
  if (!/Signed-by:/i.test(body)) violations.push({ rule: 'missing-signer', detail: 'CONSULTANT_CLOSEOUT missing Signed-by field' });
  if (!/Team&Model:/i.test(body)) violations.push({ rule: 'missing-team-model', detail: 'CONSULTANT_CLOSEOUT missing Team&Model field' });
  if (!/Role:\s*consultant/i.test(body)) violations.push({ rule: 'missing-role-consultant', detail: 'CONSULTANT_CLOSEOUT missing Role: consultant field' });
  return violations;
}

function checkEvidenceFields(body) {
  const violations = [];
  if (!/G[1-9]\s*[=:]/i.test(body)) {
    violations.push({ rule: 'missing-rubric',
      detail: 'CONSULTANT_CLOSEOUT missing G1-9 goal-lens rubric (e.g., "G1=9, G2=8, ...")' });
  }
  if (!/verification[ _-]?timestamp/i.test(body)) {
    violations.push({ rule: 'missing-verification-timestamp',
      detail: 'CONSULTANT_CLOSEOUT missing verification-timestamp field' });
  }
  if (!/(verdict|approve|approved)/i.test(body)) {
    violations.push({ rule: 'missing-verdict',
      detail: 'CONSULTANT_CLOSEOUT missing explicit verdict / approve statement' });
  }
  return violations;
}

function validate(input) {
  const closeout = findConsultantCloseout(input.comments || []);
  if (!closeout) {
    return { ok: false, violations: [{ rule: 'missing-consultant-closeout',
      detail: 'CONSULTANT_CLOSEOUT comment not found on issue' }], found: false };
  }
  const body = closeout.body || '';
  const violations = [...checkSignerFields(body), ...checkEvidenceFields(body)];
  return { ok: violations.length === 0, violations, found: true };
}

module.exports = { validate, findConsultantCloseout };
