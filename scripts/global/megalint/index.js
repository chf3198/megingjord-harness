'use strict';
// megalint — schema-aware governance lint orchestrator. Epic #1407.
// Dispatches to domain-decomposed validators. Each validator returns
// {ok, violations[]}. Caller (CI workflow) decides blocking context.

const manager = require('./manager-handoff.js');
const collaborator = require('./collaborator-handoff.js');
// #3328: doc-coverage exposed as a first-class validator so the local pre-push
// closeout-preflight can enforce the COLLABORATOR_HANDOFF doc-coverage block
// (N/A enum reason + bare `doc-coverage:` header) with the SAME strictness as CI.
const docCoverage = require('./doc-coverage.js');
const admin = require('./admin-handoff.js');
const consultant = require('./consultant-closeout.js');
const signer = require('./signer-fidelity.js');
const truthfulness = require('./body-ac-truthfulness.js');
const traceability = require('./epic-ac-traceability.js');
const mergeEvidence = require('./merge-evidence.js');
const mergeEvidencePrGate = require('./merge-evidence-pr-gate.js');
const lintAsAc = require('./lint-as-ac.js');
const workflowShaPin = require('./workflow-sha-pin.js');
const testDiscoverability = require('./test-discoverability.js');
const flawEmission = require('./flaw-emission.js');
const crossCheckoutDestructive = require('./cross-checkout-destructive.js');
const soakLanguageGuard = require('./soak-language-guard.js');
const researchFirstPhaseGate = require('./research-first-phase-gate.js');
const parityValidator = require('./parity-validator.js');
const crossTeamResponseFidelity = require('./cross-team-response-fidelity.js');
const changelogFragmentPresence = require('./changelog-fragment-presence.js');
const adminMergeException = require('./admin-merge-exception.js');
const batchCancelEvidence = require('./batch-cancel-evidence.js');
const fleetCallLint = require('./fleet-call-lint.js');
const workLogSync = require('./work-log-sync.js');
const batonTransition = require('./baton-transition.js');
const authorTeam = require('./author-team-check.js');
const epicAcDisposition = require('./epic-ac-disposition-check.js');
// flaws-recognized: per-review-point flaw-capture validator (advisory). Epic #3425 P1-a.
const flawsRecognized = require('./flaws-recognized.js');
// #3456: wire previously-orphaned validators into runAll dispatch set.
const fleetReviewRequired = require('./fleet-review-required.js');
const registryTupleCoverage = require('./registry-tuple-coverage.js');
const subIssuePreference = require('./sub-issue-preference.js');
// worktree-naming-advisory retired (Epic #3807 C3, #3811): advisory-only branch-name warner whose
// property is strictly dominated by the BLOCKING validate-branch-name.sh + branch-name.yml gates.

// parity-validator exposes run() not validate(); wrap to standard interface.
const parityValidatorAdapter = {
  validate: (input) => {
    const result = parityValidator.run(Object.assign({ backfill: false }, input || {}));
    const violations = (result.conflicts || []).map(c => ({
      rule: `parity-${c.class}`,
      detail: `${c.rule_id}: ${c.id} [${c.severity}]`,
    }));
    return { ok: violations.length === 0, violations };
  },
};

// registry-tuple-coverage exposes checkCoverage() not validate(); wrap to standard interface.
// Advisory-only: unmapped tuples warn but do not block (promotion is replay-eval-gated).
const registryTupleAdapter = {
  validate: (input) => {
    const registryOverride = (input || {}).registry;
    const result = registryTupleCoverage.checkCoverage(registryOverride);
    if (!result.ok && result.reason === 'registry-unreadable') {
      return { ok: true, violations: [{ rule: 'registry-unreadable', severity: 'advisory',
        detail: 'registry-tuple-coverage: registry unreadable; skipping' }] };
    }
    const violations = (result.unmapped || []).map(unmapped => ({
      rule: 'registry-tuple-unmapped',
      severity: 'advisory',
      detail: `${unmapped.team}:${unmapped.model} resolves to ${unmapped.resolvedTo}`
        + (unmapped.wildcardSeed ? ` (${unmapped.wildcardSeed})` : ''),
    }));
    return { ok: true, violations };
  },
};

// sub-issue-preference is a utility (no validate()); wrap to emit an advisory when
// a child issue body uses prose Refs instead of the Sub-issue marker. Input: { body }.
const subIssueAdapter = {
  validate: (input) => {
    const body = String((input || {}).body || '');
    if (!body) return { ok: true, violations: [] };
    const detected = subIssuePreference.detectParent(body);
    if (detected.source === 'prose-refs') {
      return { ok: true, violations: [{ rule: 'sub-issue-prefer-marker', severity: 'advisory',
        detail: `parent #${detected.parent} detected via prose Refs; `
          + 'prefer Sub-issue native link (<!-- sub-issue-linked: parent=N -->)' }] };
    }
    return { ok: true, violations: [] };
  },
};

const VALIDATORS = {
  'manager-handoff': manager,
  'collaborator-handoff': collaborator,
  'doc-coverage': docCoverage,
  'admin-handoff': admin,
  'consultant-closeout': consultant,
  'signer-fidelity': signer,
  'body-ac-truthfulness': truthfulness,
  'epic-ac-traceability': traceability,
  'merge-evidence': mergeEvidence,
  'merge-evidence-pr-gate': mergeEvidencePrGate,
  'lint-as-ac': lintAsAc,
  'workflow-sha-pin': workflowShaPin,
  'test-discoverability': testDiscoverability,
  'flaw-emission': flawEmission,
  'cross-checkout-destructive': crossCheckoutDestructive,
  'soak-language-guard': soakLanguageGuard,
  'research-first-phase-gate': researchFirstPhaseGate,
  'parity-validator': parityValidatorAdapter,
  'cross-team-response-fidelity': crossTeamResponseFidelity,
  'changelog-fragment-presence': changelogFragmentPresence,
  'admin-merge-exception': adminMergeException,
  'batch-cancel-evidence': batchCancelEvidence,
  'fleet-call-lint': fleetCallLint,
  'work-log-sync': workLogSync,
  'baton-transition': batonTransition,
  'author-team-check': authorTeam,
  'epic-ac-disposition-check': epicAcDisposition,
  'flaws-recognized': flawsRecognized,
  // #3456: previously-orphaned validators now wired to megalint-runAll dispatch surface.
  'fleet-review-required': fleetReviewRequired,
  'registry-tuple-coverage': registryTupleAdapter,
  'sub-issue-preference': subIssueAdapter,
};

function runAll(input) {
  const results = {};
  for (const [name, validator] of Object.entries(VALIDATORS)) {
    try {
      results[name] = validator.validate(input);
    } catch (err) {
      results[name] = { ok: false, violations: [{ rule: 'validator-error',
        detail: `${name} threw: ${err.message}` }] };
    }
  }
  const allViolations = [];
  for (const [name, result] of Object.entries(results)) {
    for (const violation of (result.violations || [])) {
      allViolations.push({ validator: name, ...violation });
    }
  }
  return { ok: allViolations.length === 0, results, violations: allViolations };
}

function run(validatorName, input) {
  if (!VALIDATORS[validatorName]) {
    throw new Error(
      `Unknown validator: ${validatorName}. Known: ${Object.keys(VALIDATORS).join(', ')}`);
  }
  return VALIDATORS[validatorName].validate(input);
}

module.exports = { runAll, run, VALIDATORS };
