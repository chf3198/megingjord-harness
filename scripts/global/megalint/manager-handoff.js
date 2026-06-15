'use strict';
// manager-handoff — validates MANAGER_HANDOFF schema + crypto signature fields.
// AC #2906: lane:trivial diff-size gate (Gap G-03 / OWASP ASI09).
// AC #2911: cross_runtime_writes hard-blocking gate (Rule 1.9 promotion).

const fs = require('node:fs');
const path = require('node:path');
const sig = require('../governance-artifact-signature');
const { isValidStrategy } = require('../test-strategy-enum');
const REQUIRED_FIELDS = ['scope', 'lane', 'test_strategy', 'acceptance', 'gates', 'related_tickets', 'overlap_decision'];
const PHASE_ONE_LABEL = process.env.PHASE_ONE_LABEL || 'phase-gate:phase-1';

// Default cross-runtime path prefixes that trigger the cross_runtime_writes gate.
// Configurable via governance-rules.yaml (rule_id: cross-runtime-writes-required).
const DEFAULT_CROSS_RUNTIME_PATHS = ['.claude/', '.codex/', '.copilot/'];

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

/**
 * Load cross-runtime path prefixes from governance-rules.yaml.
 * Falls back to DEFAULT_CROSS_RUNTIME_PATHS if the config is absent or malformed.
 * Emits a warning to stderr when a present config block cannot be parsed, so
 * silent drift is observable (fail-closed: defaults are a safe floor, not a
 * silent escape hatch from a misconfigured block).
 * @returns {string[]}
 */
function loadCrossRuntimePaths() {
  try {
    const rulesPath = path.resolve(__dirname, '..', '..', '..', 'config', 'governance-rules.yaml');
    const raw = fs.readFileSync(rulesPath, 'utf8');
    // Extract the cross_runtime_paths block under rule_id: cross-runtime-writes-required.
    const block = raw.match(
      /rule_id:\s*cross-runtime-writes-required[\s\S]*?cross_runtime_paths:([\s\S]*?)(?:\n  -\s*rule_id:|\n\s*enum_values:)/
    );
    if (block) {
      const items = block[1].match(/^\s{6}-\s*(.+)$/gm);
      if (items && items.length > 0) {
        return items.map((line) => line.replace(/^\s+-\s*/, '').trim());
      }
      // Block matched but items could not be parsed — emit observable warning.
      process.stderr.write(
        '[manager-handoff] WARNING: governance-rules.yaml cross_runtime_paths block found ' +
        'but could not be parsed. Falling back to DEFAULT_CROSS_RUNTIME_PATHS. ' +
        'Check config/governance-rules.yaml cross-runtime-writes-required rule. Refs #2911.\n'
      );
    }
  } catch { /* config absent: use default */ }
  return DEFAULT_CROSS_RUNTIME_PATHS;
}

const TRIVIAL_DIFF_THRESHOLD = loadTrivialThreshold();
const CROSS_RUNTIME_PATHS = loadCrossRuntimePaths();

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

/**
 * AC #2911: hard-blocking cross_runtime_writes gate.
 *
 * Scope-correctness: only fires when the PR diff actually touches a cross-runtime
 * config path (.claude/, .codex/, .copilot/). Tickets that genuinely do NOT touch
 * those paths are unaffected — this gate does NOT block them.
 *
 * FAIL-CLOSED design (CWE-754 / OWASP ASI09):
 *   - diffFiles must be an Array when the PR touches cross-runtime paths.
 *   - null/undefined/non-array diffFiles on a cross-runtime-touching PR is itself
 *     a violation — absence of evidence = violation, not a silent pass.
 *   - An empty cross_runtime_writes value (empty string, "[]", or "none" without
 *     explicit N/A rationale) is treated as absent.
 *
 * @param {string} body - MANAGER_HANDOFF comment body
 * @param {string[]} diffFiles - list of file paths touched in the PR diff (caller-supplied)
 * @param {string[]} paths - configurable cross-runtime path prefixes (defaults to CROSS_RUNTIME_PATHS)
 * @returns {boolean} true when the ticket is in scope for the cross_runtime_writes rule
 */
// Does the PR diff (or, if diffFiles is absent, the declared field) put this ticket
// in scope for the cross_runtime_writes rule? Scope-correct: a prefix must be the FIRST
// path segment (startsWith), not a substring — src/x/.claude/y is NOT cross-runtime (#2911).
// diffFiles absent → in-scope only if the HANDOFF itself declares the field (fail-closed
// for declarers; unrelated tickets that omit both are not blocked).
function diffTouchesCrossRuntime(body, diffFiles, paths) {
  if (!Array.isArray(diffFiles)) return extractField(body, 'cross_runtime_writes') !== null;
  return diffFiles.some((filePath) => {
    if (typeof filePath !== 'string') return false;
    const normalized = filePath.replace(/\\/g, '/');
    return paths.some((prefix) => normalized.startsWith(prefix));
  });
}

// Missing or trivially-blank cross_runtime_writes field → hard violation (or null if OK).
function crossRuntimeFieldViolation(declared, paths) {
  if (declared === null) {
    return { rule: 'cross-runtime-writes-missing', severity: 'hard',
      detail: 'MANAGER_HANDOFF is missing required cross_runtime_writes field. PR diff touches ' +
        'cross-runtime config paths (' + paths.join(', ') + '). Per ' +
        'instructions/cross-team-artifact-write.instructions.md, list each touched path with ' +
        'target_team and schema_source. Refs #2911.' };
  }
  const trimmed = declared.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed || lower === '[]' || lower === 'none' || lower === 'n/a') {
    return { rule: 'cross-runtime-writes-empty', severity: 'hard',
      detail: 'MANAGER_HANDOFF cross_runtime_writes field is present but empty or trivially blank ' +
        `(got: "${trimmed}"). Must list each cross-runtime path with target_team and schema_source. ` +
        'Use "cross_runtime_writes: N/A" only when the rule genuinely does not apply. Refs #2911.' };
  }
  return null;
}

// target_team_sign_off: pending anywhere in the field → hard violation (or null).
function signOffPendingViolation(body) {
  const lines = body.match(/target_team_sign_off\s*:\s*([^\n]+)/gi);
  if (lines && lines.some((line) => /pending/i.test(line))) {
    return { rule: 'cross-runtime-writes-sign-off-pending', severity: 'hard',
      detail: 'MANAGER_HANDOFF cross_runtime_writes has target_team_sign_off: pending. Baton must ' +
        'not advance to Collaborator until the target team posts a TEAM_RESPONSE with ' +
        'verdict: schema-valid. Refs #2911 + instructions/cross-team-artifact-write.instructions.md.' };
  }
  return null;
}

function checkCrossRuntimeWrites(body, diffFiles, crossPaths) {
  const paths = Array.isArray(crossPaths) && crossPaths.length > 0 ? crossPaths : CROSS_RUNTIME_PATHS;
  if (!diffTouchesCrossRuntime(body, diffFiles, paths)) return []; // scope-correct: rule N/A
  const declared = extractField(body, 'cross_runtime_writes');
  const fieldViol = crossRuntimeFieldViolation(declared, paths);
  if (fieldViol) return [fieldViol];
  const signOff = signOffPendingViolation(body);
  return signOff ? [signOff] : [];
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
    ...checkCrossRuntimeWrites(handoff.body, input.diffFiles, CROSS_RUNTIME_PATHS),
    ...checkPhaseOneFields(handoff.body, input.labels),
    ...checkCrypto(handoff.body),
  ];
  return { ok: violations.length === 0, violations, found: true };
}

module.exports = {
  validate, findManagerHandoff, extractField, REQUIRED_FIELDS,
  checkLaneTrivialDiffSize, TRIVIAL_DIFF_THRESHOLD,
  checkCrossRuntimeWrites, CROSS_RUNTIME_PATHS, DEFAULT_CROSS_RUNTIME_PATHS,
  loadCrossRuntimePaths,
};
