// baton-env-flag-classifier.spec.js -- Tests for env-flag-classifier.
// Refs #3292, Epic #3284 (W4). AC3: env flags reclassified, CI authority removed.
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyFlag,
  flagsByClassification,
  BYPASS_FLAG_REGISTRY,
} = require('../scripts/global/baton-bypass/env-flag-classifier');

// -- classifyFlag --

describe('classifyFlag', () => {
  it('classifies MEGINGJORD_HAMR_DISABLED as ux-local-only', () => {
    const result = classifyFlag('MEGINGJORD_HAMR_DISABLED');
    assert.equal(result.known, true);
    assert.equal(result.classification, 'ux-local-only');
    assert.equal(result.ci_authority, false);
  });

  it('classifies SKIP_CLOSEOUT_PREFLIGHT as authority-affecting', () => {
    const result = classifyFlag('SKIP_CLOSEOUT_PREFLIGHT');
    assert.equal(result.known, true);
    assert.equal(result.classification, 'authority-affecting');
    assert.equal(result.ci_authority, false);
  });

  it('classifies PUSH_GATES_BYPASS as authority-affecting', () => {
    const result = classifyFlag('PUSH_GATES_BYPASS');
    assert.equal(result.known, true);
    assert.equal(result.classification, 'authority-affecting');
    assert.equal(result.ci_authority, false);
  });

  it('classifies PHASE0_GATE_BYPASS as authority-affecting', () => {
    const result = classifyFlag('PHASE0_GATE_BYPASS');
    assert.equal(result.known, true);
    assert.equal(result.classification, 'authority-affecting');
    assert.equal(result.ci_authority, false);
  });

  it('classifies MEGINGJORD_MCP_DISABLED as ux-local-only', () => {
    const result = classifyFlag('MEGINGJORD_MCP_DISABLED');
    assert.equal(result.known, true);
    assert.equal(result.classification, 'ux-local-only');
  });

  it('classifies SKIP_DRIFT_LINT as authority-affecting', () => {
    const result = classifyFlag('SKIP_DRIFT_LINT');
    assert.equal(result.known, true);
    assert.equal(result.classification, 'authority-affecting');
    assert.equal(result.ci_authority, false);
  });

  it('returns unknown for an unregistered flag', () => {
    const result = classifyFlag('SOME_RANDOM_FLAG');
    assert.equal(result.known, false);
  });

  it('every authority-affecting flag has ci_authority set to false', () => {
    const authorityFlags = flagsByClassification('authority-affecting');
    for (const flagName of authorityFlags) {
      const result = classifyFlag(flagName);
      assert.equal(result.ci_authority, false,
        flagName + ' should have ci_authority false');
    }
  });

  it('every ux-local-only flag has ci_authority set to false', () => {
    const localFlags = flagsByClassification('ux-local-only');
    for (const flagName of localFlags) {
      const result = classifyFlag(flagName);
      assert.equal(result.ci_authority, false,
        flagName + ' should have ci_authority false');
    }
  });
});

// -- BYPASS_FLAG_REGISTRY --

describe('BYPASS_FLAG_REGISTRY', () => {
  it('is the allow-list (all entries have required fields)', () => {
    const keys = Object.keys(BYPASS_FLAG_REGISTRY);
    assert.ok(keys.length > 0, 'registry must not be empty');
    for (const key of keys) {
      const entry = BYPASS_FLAG_REGISTRY[key];
      assert.ok(entry.classification, key + ' missing classification');
      assert.ok(entry.description, key + ' missing description');
      assert.equal(typeof entry.ci_authority, 'boolean',
        key + ' ci_authority must be boolean');
    }
  });

  it('contains the known authority-affecting flags', () => {
    const expected = [
      'SKIP_CLOSEOUT_PREFLIGHT',
      'PUSH_GATES_BYPASS',
      'PHASE0_GATE_BYPASS',
      'SKIP_DRIFT_LINT',
      'PRE_COMMIT_DOCS_BYPASS',
    ];
    for (const flagName of expected) {
      assert.ok(BYPASS_FLAG_REGISTRY[flagName],
        flagName + ' should be in registry');
      assert.equal(BYPASS_FLAG_REGISTRY[flagName].classification,
        'authority-affecting',
        flagName + ' should be authority-affecting');
    }
  });
});

// -- flagsByClassification --

describe('flagsByClassification', () => {
  it('returns only ux-local-only flags for that classification', () => {
    const flags = flagsByClassification('ux-local-only');
    assert.ok(flags.length > 0);
    for (const flagName of flags) {
      assert.equal(BYPASS_FLAG_REGISTRY[flagName].classification, 'ux-local-only');
    }
  });

  it('returns only authority-affecting flags for that classification', () => {
    const flags = flagsByClassification('authority-affecting');
    assert.ok(flags.length > 0);
    for (const flagName of flags) {
      assert.equal(BYPASS_FLAG_REGISTRY[flagName].classification, 'authority-affecting');
    }
  });
});
