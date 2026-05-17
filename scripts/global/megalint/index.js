'use strict';
// megalint — schema-aware governance lint orchestrator. Epic #1407.
// Dispatches to 7 domain-decomposed validators. Each validator is a pure
// function returning {ok, violations[]}. Caller (CI workflow) decides whether
// each violation is advisory or blocking based on context.

const manager = require('./manager-handoff.js');
const collaborator = require('./collaborator-handoff.js');
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
const signerFormatCanonical = require('./signer-format-canonical.js');
const flawEmission = require('./flaw-emission.js');
const crossCheckoutDestructive = require('./cross-checkout-destructive.js');
const soakLanguageGuard = require('./soak-language-guard.js');

const VALIDATORS = {
  'manager-handoff': manager,
  'collaborator-handoff': collaborator,
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
  'signer-format-canonical': signerFormatCanonical,
  'flaw-emission': flawEmission,
  'cross-checkout-destructive': crossCheckoutDestructive,
  'soak-language-guard': soakLanguageGuard,
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
    throw new Error(`Unknown validator: ${validatorName}. Known: ${Object.keys(VALIDATORS).join(', ')}`);
  }
  return VALIDATORS[validatorName].validate(input);
}

module.exports = { runAll, run, VALIDATORS };
