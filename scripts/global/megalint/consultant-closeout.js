'use strict';
// consultant-closeout — schema, signature, rubric, and Tier-3 checks.

const path = require('path');
const fs = require('fs');
const sig = require(path.join(__dirname, '..', 'governance-artifact-signature.js'));
const { enforceTier3Emission } = require(path.join(__dirname, 'goal-failure-emission.js'));

function findConsultantCloseout(comments) {
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
  const legacyRubric = /G[1-9]\s*[=:]/i.test(body);
  const structuredRubric = /rubric_version["']?\s*[:=]\s*["']?g1-g9-v2/i.test(body)
    && /boxes_checked/i.test(body) && /boxes_total/i.test(body);
  // #1811 + #1750: accept rubric_provisional flag while Epic #1745 calibration corpus is built.
  // The flag must coexist with SOME rubric form (legacy or structured) — it cannot replace rubric entirely.
  const provisional = /rubric_provisional["']?\s*[:=]\s*["']?true/i.test(body)
    || /provisional["']?\s*[:=]\s*["']?true/i.test(body);
  if (!legacyRubric && !structuredRubric && !provisional) {
    violations.push({ rule: 'missing-rubric', detail: 'CONSULTANT_CLOSEOUT missing legacy G1-9 rubric or v2 deterministic rubric JSON or rubric_provisional:true marker (Epic #1745).' });
  }
  if (provisional && !legacyRubric && !structuredRubric) {
    violations.push({ rule: 'rubric-provisional-advisory', severity: 'advisory', detail: 'rubric_provisional:true accepted in advisory mode pending Epic #1745 calibration corpus. Include legacy or structured rubric alongside the flag.' });
  }
  if (!/verification[ _-]?timestamp/i.test(body)) violations.push({ rule: 'missing-verification-timestamp', detail: 'CONSULTANT_CLOSEOUT missing verification-timestamp field' });
  if (!/(verdict|approve|approved)/i.test(body)) violations.push({ rule: 'missing-verdict', detail: 'CONSULTANT_CLOSEOUT missing explicit verdict / approve statement' });
  return violations;
}

function checkCrypto(body) {
  if (!/Crypto-Algorithm:/i.test(body)) return [];
  const result = sig.verifyArtifact(body, 'consultant');
  return result.ok ? [] : result.violations.map(v => ({ rule: 'crypto-signature-invalid', detail: `CONSULTANT_CLOSEOUT ${v}` }));
}

function checkTier3Emission(body, input) {
  if (!input.ticketRef) return [];
  const result = enforceTier3Emission(body, input.ticketRef, input.incidentsPath);
  return result.violations;
}

function checkGovTokenResolution(body, input) {
  const catalog = path.join(__dirname, '..', '..', '..', 'instructions', 'governance-controls.instructions.md');
  let known;
  try { known = new Set((fs.readFileSync(catalog, 'utf8').match(/\bGOV-\d{3}\b/g) || [])); }
  catch { return [{ rule: 'missing-governance-catalog', detail: 'instructions/governance-controls.instructions.md not found' }]; }
  const text = [input.body || '', input.prBody || '', body || ''].join('\n');
  const unresolved = [...new Set((text.match(/\bGOV-\d{3}\b/g) || []))].filter(t => !known.has(t));
  return unresolved.map(t => ({ rule: 'unresolved-governance-token', detail: `Token ${t} has no catalog source in instructions/governance-controls.instructions.md` }));
}

function hasChildRef(body) {
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
    ...checkGovTokenResolution(body, input),
    ...checkSubstantiveContent(body, input.isEpic === true),
  ];
  return { ok: violations.length === 0, violations, found: true };
}

module.exports = { validate, findConsultantCloseout };
