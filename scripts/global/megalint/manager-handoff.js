'use strict';
// manager-handoff — validates MANAGER_HANDOFF schema + crypto signature fields.
// AC #2906: lane:trivial diff-size gate (Gap G-03 / OWASP ASI09).

const fs = require('node:fs');
const path = require('node:path');
const sig = require('../governance-artifact-signature');
const { extractField } = require('./artifact-field-extract');
const { isValidStrategy } = require('../test-strategy-enum');
const wtGate = require('../worktree-lifecycle-gate');
const REQUIRED_FIELDS = ['scope', 'lane', 'test_strategy', 'acceptance', 'gates', 'related_tickets', 'overlap_decision'];
const PHASE_ONE_LABEL = process.env.PHASE_ONE_LABEL || 'phase-gate:phase-1';

// Load trivial-lane diff threshold from governance-rules.yaml or env override.
function loadTrivialThreshold() {
  if (process.env.TRIVIAL_DIFF_THRESHOLD) return Number(process.env.TRIVIAL_DIFF_THRESHOLD);
  try {
    const rulesPath = path.resolve(__dirname, '..', '..', '..', 'config', 'governance-rules.yaml');
    const raw = fs.readFileSync(rulesPath, 'utf8');
    const match = raw.match(/rule_id:\s*lane-trivial-diff-size[\s\S]*?threshold:\s*(\d+)/);
    if (match) return Number(match[1]);
  } catch { /* config absent: use default */ }
  return 50;
}

const TRIVIAL_DIFF_THRESHOLD = loadTrivialThreshold();

// Load cross-runtime paths from governance-rules.yaml or CROSS_RUNTIME_PATHS env override.
function loadCrossRuntimePaths() {
  if (process.env.CROSS_RUNTIME_PATHS) return process.env.CROSS_RUNTIME_PATHS.split(',').map(p => p.trim());
  try {
    const raw = fs.readFileSync(
      path.resolve(__dirname, '..', '..', '..', 'config', 'governance-rules.yaml'), 'utf8');
    const ruleStart = raw.indexOf('rule_id: cross-runtime-writes-gate');
    if (ruleStart >= 0) {
      const nextRule = raw.indexOf('\n  - rule_id:', ruleStart + 1);
      const block = nextRule >= 0 ? raw.slice(ruleStart, nextRule) : raw.slice(ruleStart);
      const pathsIdx = block.indexOf('cross_runtime_paths:');
      if (pathsIdx >= 0) {
        const paths = [...block.slice(pathsIdx).matchAll(/\n\s+- ['"]?([^'"\n\r]+)['"]?/g)]
          .map(m => m[1].trim()).filter(Boolean);
        if (paths.length) return paths;
      }
    }
  } catch { /* config absent: use default */ }
  return ['.claude/', '.codex/', '.copilot/'];
}

const CROSS_RUNTIME_PATHS = loadCrossRuntimePaths();

// AC #2911 — block when diff touches cross-runtime paths but cross_runtime_writes is absent.
// FAIL-OPEN when changedPaths is not supplied (caller has not yet been updated).
function checkCrossRuntimeWrites(body, changedPaths, configPaths) {
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) return [];
  const paths = Array.isArray(configPaths) && configPaths.length ? configPaths : CROSS_RUNTIME_PATHS;
  const affected = changedPaths.filter(p => paths.some(cp => p === cp || p.startsWith(cp) || p.includes(`/${cp.replace(/\/$/, '')}/`)));
  if (affected.length === 0) return [];
  const declared = extractField(body, 'cross_runtime_writes');
  if (!declared || !declared.trim() || /^none$/i.test(declared.trim())) {
    return [{
      rule: 'cross-runtime-writes-missing',
      detail: `MANAGER_HANDOFF diff touches cross-runtime path(s) [${affected.join(', ')}] ` +
        'but cross_runtime_writes field is absent or none. ' +
        'List all cross-runtime files under cross_runtime_writes:.',
      severity: 'hard',
    }];
  }
  return [];
}

function findManagerHandoff(comments) {
  const headerRe = /(^|\n)\s*(?:\*\*|##\s+)?MANAGER_HANDOFF\b/;
  return [...(comments || [])].reverse().find(c => headerRe.test(c.body || ''));
}
function checkRequiredFields(body) {
  const violations = [];
  for (const field of REQUIRED_FIELDS) {
    if (!extractField(body, field)) {
      violations.push({ rule: `missing-${field}`,
        detail: `MANAGER_HANDOFF missing required field '${field}:' per role-baton-routing schema` });
    }
  }
  if (extractField(body, 'related_tickets') && !/#\d+/.test(extractField(body, 'related_tickets'))) {
    violations.push({ rule: 'invalid-related_tickets', detail: "MANAGER_HANDOFF related_tickets must include one or more issue refs like '#123'" }); }
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
// AC #2906 — block lane:trivial declarations when actual diff size exceeds threshold.
// FAIL-CLOSED (CWE-754): missing/invalid diffLines on a lane:trivial declaration is
// itself a violation. Callers MUST supply a finite non-negative integer diff count.
// diffLines: total added+removed lines from the PR diff (caller-supplied).
function checkLaneTrivialDiffSize(body, diffLines, threshold) {
  const declared = extractField(body, 'lane');
  if (!declared || !/lane:trivial/i.test(declared)) return [];
  // Reject null/undefined/NaN/Infinity/negative — absence of evidence = violation.
  if (diffLines == null || !Number.isFinite(diffLines) || diffLines < 0) {
    return [{
      rule: 'lane:trivial-diff-missing',
      detail: 'MANAGER_HANDOFF declares lane:trivial but diff line count is absent or invalid ' +
        `(got: ${String(diffLines)}). Caller must supply a finite non-negative integer diff count.`,
      severity: 'hard',
    }];
  }
  const limit = Number.isFinite(threshold) ? threshold : TRIVIAL_DIFF_THRESHOLD;
  if (diffLines > limit) {
    return [{
      rule: 'lane:trivial-diff-too-large',
      detail: `MANAGER_HANDOFF declares lane:trivial but diff is ${diffLines} lines (threshold: ${limit}). ` +
        'Re-classify to an appropriate lane (lane:code-change, lane:config-only, etc.).',
      severity: 'hard',
    }];
  }
  return [];
}
function checkCrypto(body) {
  if (!/Crypto-Algorithm:/i.test(body)) return [];
  const result = sig.verifyArtifact(body, 'manager');
  return result.ok ? [] : result.violations.map(violation => ({
    rule: 'crypto-signature-invalid',
    detail: `MANAGER_HANDOFF ${violation}`,
  }));
}

// #2912: block merge when a TEAM_QUESTION sign-off is still pending.
function checkTargetTeamSignOff(body) {
  const val = extractField(body, 'target_team_sign_off');
  if (!val) return [];
  if (/^pending$/i.test(val.trim())) {
    return [{
      rule: 'target-team-sign-off-pending',
      detail: 'MANAGER_HANDOFF target_team_sign_off is "pending". Resolve the TEAM_QUESTION sign-off before merging.',
      severity: 'hard',
    }];
  }
  return [];
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
    ...checkLaneTrivialDiffSize(handoff.body, input.diffLines, TRIVIAL_DIFF_THRESHOLD),
    ...checkCrossRuntimeWrites(handoff.body, input.changedPaths),
    ...checkPhaseOneFields(handoff.body, input.labels),
    ...checkTargetTeamSignOff(handoff.body),
    ...checkCrypto(handoff.body),
    ...wtGate.checkManager(handoff.body, input),
  ];
  return { ok: violations.length === 0, violations, found: true };
}

module.exports = {
  validate, findManagerHandoff, extractField, REQUIRED_FIELDS,
  checkLaneTrivialDiffSize, TRIVIAL_DIFF_THRESHOLD, checkTargetTeamSignOff,
  checkCrossRuntimeWrites, CROSS_RUNTIME_PATHS,
};
