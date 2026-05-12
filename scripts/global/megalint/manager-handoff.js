'use strict';
// manager-handoff — validates MANAGER_HANDOFF schema fields per role-baton-routing.
// Epic #1407 AC3; subsumes #1335.

const REQUIRED_FIELDS = ['scope', 'lane', 'test_strategy', 'acceptance', 'gates'];

function findManagerHandoff(comments) {
  return (comments || []).reverse().find(c => (c.body || '').includes('MANAGER_HANDOFF'));
}

function extractField(body, field) {
  const pattern = new RegExp(`(?:^|\\n)[-*]?\\s*${field}\\s*:\\s*([^\\n]+)`, 'i');
  const match = body.match(pattern);
  return match ? match[1].trim() : null;
}

function checkRequiredFields(handoffBody) {
  const violations = [];
  for (const field of REQUIRED_FIELDS) {
    if (!extractField(handoffBody, field)) {
      violations.push({ rule: `missing-${field}`,
        detail: `MANAGER_HANDOFF missing required field '${field}:' per role-baton-routing schema` });
    }
  }
  return violations;
}

function checkLaneConsistency(handoffBody, expectedLane) {
  if (!expectedLane) return [];
  const declared = extractField(handoffBody, 'lane');
  if (declared && declared !== expectedLane && !declared.includes(expectedLane)) {
    return [{ rule: 'lane-mismatch',
      detail: `MANAGER_HANDOFF lane='${declared}' but issue has label='${expectedLane}'` }];
  }
  return [];
}

function validate(input) {
  const handoff = findManagerHandoff(input.comments || []);
  if (!handoff) {
    const violations = input.isEpic
      ? [{ rule: 'epic-manager-handoff-missing',
          detail: 'Epic must have a MANAGER_HANDOFF comment defining scope' }]
      : [];
    return { ok: violations.length === 0, violations, found: false };
  }
  const violations = [
    ...checkRequiredFields(handoff.body),
    ...checkLaneConsistency(handoff.body, input.lane),
  ];
  return { ok: violations.length === 0, violations, found: true };
}

module.exports = { validate, findManagerHandoff, extractField, REQUIRED_FIELDS };
