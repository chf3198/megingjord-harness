'use strict';
// manager-handoff — validates MANAGER_HANDOFF schema + crypto signature fields.

const sig = require('../governance-artifact-signature');
const { isValidStrategy } = require('../test-strategy-enum');
const REQUIRED_FIELDS = ['scope', 'lane', 'test_strategy', 'acceptance', 'gates'];
const PHASE_ONE_LABEL = process.env.PHASE_ONE_LABEL || 'phase-gate:phase-1';

function findManagerHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?MANAGER_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
}
function extractField(body, field) {
  const m = body.match(new RegExp(`(?:^|\\n)[-*]?\\s*${field}\\s*:\\s*([^\\n]+)`, 'i'));
  return m ? m[1].trim() : null;
}
function checkRequiredFields(body) {
  const violations = [];
  for (const field of REQUIRED_FIELDS) {
    if (!extractField(body, field)) {
      violations.push({ rule: `missing-${field}`,
        detail: `MANAGER_HANDOFF missing required field '${field}:' per role-baton-routing schema` });
    }
  }
  if (!/Signed-by:/i.test(body)) violations.push({ rule: 'missing-signer', detail: 'MANAGER_HANDOFF missing Signed-by field' });
  if (!/Team&Model:/i.test(body)) violations.push({ rule: 'missing-team-model', detail: 'MANAGER_HANDOFF missing Team&Model field' });
  if (!/Role:\s*manager/i.test(body)) violations.push({ rule: 'missing-role-manager', detail: 'MANAGER_HANDOFF missing Role: manager field' });
  return violations;
}
function checkTestStrategy(body) {
  const declared = extractField(body, 'test_strategy');
  if (!declared) return []; // missing-field already caught by checkRequiredFields
  if (!isValidStrategy(declared)) {
    return [{
      rule: 'lane:unknown-test-strategy',
      detail: `MANAGER_HANDOFF test_strategy '${declared}' is not in the canonical enum. ` +
        'See scripts/global/test-strategy-enum.js for valid values.',
      severity: 'advisory',
    }];
  }
  return [];
}
function checkLaneConsistency(body, expectedLane) {
  if (!expectedLane) return [];
  const declared = extractField(body, 'lane');
  return declared && declared !== expectedLane && !declared.includes(expectedLane)
    ? [{ rule: 'lane-mismatch', detail: `MANAGER_HANDOFF lane='${declared}' but issue has label='${expectedLane}'` }]
    : [];
}
function checkCrypto(body) {
  if (!/Crypto-Algorithm:/i.test(body)) return [];
  const result = sig.verifyArtifact(body, 'manager');
  return result.ok ? [] : result.violations.map(violation => ({
    rule: 'crypto-signature-invalid',
    detail: `MANAGER_HANDOFF ${violation}`,
  }));
}

function checkPhaseOneFields(body, labels) {
  if (!(labels || []).includes(PHASE_ONE_LABEL)) return [];
  const violations = [];
  const gateSatisfied = extractField(body, 'phase_gate_satisfied');
  const phaseSources = extractField(body, 'phase_0_sources');
  if (!gateSatisfied || !/^yes$/i.test(gateSatisfied)) {
    violations.push({
      rule: 'missing-phase-gate-satisfied',
      detail: "Phase-1 MANAGER_HANDOFF must include 'phase_gate_satisfied: yes'",
    });
  }
  if (!phaseSources || !/#\d+/.test(phaseSources)) {
    violations.push({
      rule: 'missing-phase0-sources',
      detail: "Phase-1 MANAGER_HANDOFF must include 'phase_0_sources: [#N, ...]'",
    });
  }
  return violations;
}

function validate(input) {
  const handoff = findManagerHandoff(input.comments || []);
  if (!handoff) {
    const violations = input.isEpic ? [{ rule: 'epic-manager-handoff-missing', detail: 'Epic must have a MANAGER_HANDOFF comment defining scope' }] : [];
    return { ok: violations.length === 0, violations, found: false };
  }
  const violations = [
    ...checkRequiredFields(handoff.body),
    ...checkTestStrategy(handoff.body),
    ...checkLaneConsistency(handoff.body, input.lane),
    ...checkPhaseOneFields(handoff.body, input.labels),
    ...checkCrypto(handoff.body),
  ];
  return { ok: violations.length === 0, violations, found: true };
}

module.exports = { validate, findManagerHandoff, extractField, REQUIRED_FIELDS };
