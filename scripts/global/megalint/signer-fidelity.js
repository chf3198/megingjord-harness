'use strict';
// signer-fidelity — rejects issue bodies using client identity for worker artifacts.
// Epic #1407 AC4.

const CLIENT_IDENTITIES = ['Curtis Franks'];

function findSignerField(body, fieldName = 'Signed-by') {
  const pattern = new RegExp(`${fieldName}\\s*:\\s*([^\\n·,]+?)(?=\\s*[·,\\n]|$)`, 'i');
  const match = (body || '').match(pattern);
  return match ? match[1].trim() : null;
}

function isClientIdentity(name) {
  if (!name) return false;
  return CLIENT_IDENTITIES.some(c => name.trim().toLowerCase() === c.toLowerCase());
}

function checkSignedBy(body) {
  const violations = [];
  const matches = [...body.matchAll(/Signed-by\s*:\s*([^\n·,]+?)(?=\s*[·,\n]|$)/gi)];
  for (const match of matches) {
    if (isClientIdentity(match[1].trim())) {
      violations.push({
        rule: 'client-identity-as-signer',
        detail: `Issue body uses client identity "${match[1].trim()}" as Signed-by — workers must use a worker alias per team-model-signing.instructions.md`,
      });
    }
  }
  return violations;
}

function dedupe(violations) {
  const seen = new Set();
  const unique = [];
  for (const violation of violations) {
    const key = `${violation.rule}::${violation.detail}`;
    if (!seen.has(key)) { seen.add(key); unique.push(violation); }
  }
  return unique;
}

function validate(input) {
  const body = input.body || '';
  const violations = checkSignedBy(body);
  const aiSig = findSignerField(body, 'AI-Signature');
  if (isClientIdentity(aiSig)) {
    violations.push({
      rule: 'client-identity-as-ai-signature',
      detail: `Issue body uses client identity "${aiSig}" as AI-Signature trailer`,
    });
  }
  const unique = dedupe(violations);
  return { ok: unique.length === 0, violations: unique };
}

module.exports = { validate, isClientIdentity, findSignerField, CLIENT_IDENTITIES };
