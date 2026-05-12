'use strict';
// collaborator-handoff — validates COLLABORATOR_HANDOFF signer + content.

const path = require('path');
const { roleIdentity } = require(path.join(__dirname, '..', 'baton-independence.js'));

const LIGHTWEIGHT = ['lane:docs-research', 'lane:docs-only', 'lane:trivial', 'lane:config-only'];

function findCollaboratorHandoff(comments) {
  return (comments || []).reverse().find(c => (c.body || '').includes('COLLABORATOR_HANDOFF'));
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
  if (LIGHTWEIGHT.includes(input.lane)) {
    return { ok: true, violations: [], reason: 'lightweight-lane-skip' };
  }
  const handoff = findCollaboratorHandoff(input.comments || []);
  if (!handoff) {
    return { ok: false, violations: [{ rule: 'missing-collaborator-handoff',
      detail: 'COLLABORATOR_HANDOFF comment not found on issue' }], found: false };
  }
  const violations = checkSignerFields(handoff.body || '');
  const signer = roleIdentity({ body: handoff.body, author: handoff.user && handoff.user.login });
  return { ok: violations.length === 0, violations, found: true, signer };
}

module.exports = { validate, findCollaboratorHandoff };
