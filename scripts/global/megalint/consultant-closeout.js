'use strict';
// consultant-closeout — validates schema + Ed25519 crypto signature.
// Epic #1407 AC7: requires verification-timestamp + G1-9 rubric atop signer fields.
// Epic #1308 Tier-3 (#1376): sub-7 goal scores require corresponding events.
// Epic #1298: Crypto-* fields verified against signature registry.

const path = require('path');
const sig = require(path.join(__dirname, '..', 'governance-artifact-signature.js'));
const { enforceTier3Emission } = require(path.join(__dirname, 'goal-failure-emission.js'));

function findConsultantCloseout(comments) {
  // Match the marker as a header — not arbitrary mentions in analysis text.
  // Accepted forms: `**CONSULTANT_CLOSEOUT`, `## CONSULTANT_CLOSEOUT`, or line-leading.
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?CONSULTANT_CLOSEOUT(?:_EPIC_CLOSEOUT)?\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
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
  if (!/G[1-9]\s*[=:]/i.test(body)) violations.push({ rule: 'missing-rubric', detail: 'CONSULTANT_CLOSEOUT missing G1-9 goal-lens rubric (e.g., "G1=9, G2=8, ...")' });
  if (!/verification[ _-]?timestamp/i.test(body)) violations.push({ rule: 'missing-verification-timestamp', detail: 'CONSULTANT_CLOSEOUT missing verification-timestamp field' });
  if (!/(verdict|approve|approved)/i.test(body)) violations.push({ rule: 'missing-verdict', detail: 'CONSULTANT_CLOSEOUT missing explicit verdict / approve statement' });
  return violations;
}

function checkCrypto(body) {
  // Only enforce if Crypto-Algorithm field is present (additive model — opt-in per artifact).
  if (!/Crypto-Algorithm:/i.test(body)) return [];
  const result = sig.verifyArtifact(body, 'consultant');
  return result.ok ? [] : result.violations.map(v => ({ rule: 'crypto-signature-invalid', detail: `CONSULTANT_CLOSEOUT ${v}` }));
}

function checkTier3Emission(body, input) {
  if (!input.ticketRef) return [];
  const result = enforceTier3Emission(body, input.ticketRef, input.incidentsPath);
  return result.violations;
}

function hasChildRef(body) {
  // Match `#NNN` outside of common false-positives (URLs, hex colors).
  const matches = (body || '').match(/(?:^|[\s(\[,;])#(\d{2,5})\b/g) || [];
  return matches.length > 0;
}

function hasPrRef(body) {
  return /\b(?:PR|pull[\/\\]|pull\s+request)\s*#?\d+|pull\/\d+/i.test(body || '');
}

function hasResearchRef(body) {
  return /research\/[\w-]+\.md/i.test(body || '');
}

function checkSubstantiveContent(body, isEpic) {
  if (!isEpic) return [];
  if (hasChildRef(body) || hasPrRef(body) || hasResearchRef(body)) return [];
  return [{
    rule: 'epic-closeout-no-substantive-evidence',
    detail: 'CONSULTANT_CLOSEOUT on an Epic must reference substantive evidence: at least one of '
      + '(a) #N child issue ref, (b) PR ref (PR #N or pull/N), (c) research/*.md path. '
      + 'Schema-fields-only closeouts (rubric + verdict + timestamp + signer) are insufficient — see #1453.',
  }];
}

function validate(input) {
  const closeout = findConsultantCloseout(input.comments || []);
  if (!closeout) {
    return { ok: false, violations: [{ rule: 'missing-consultant-closeout', detail: 'CONSULTANT_CLOSEOUT comment not found on issue' }], found: false };
  }
  const body = closeout.body || '';
  const violations = [
    ...checkSignerFields(body),
    ...checkEvidenceFields(body),
    ...checkCrypto(body),
    ...checkTier3Emission(body, input),
    ...checkSubstantiveContent(body, input.isEpic === true),
  ];
  return { ok: violations.length === 0, violations, found: true };
}

module.exports = { validate, findConsultantCloseout };
