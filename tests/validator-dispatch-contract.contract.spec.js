'use strict';
// tests/validator-dispatch-contract.contract.spec.js
// Refs #3456 (Epic #3411 Carve-out 2) — dispatch contract gate.
// Asserts: every discovered validator has a non-empty dispatchedBy;
// the 4 formerly-orphaned validators are now wired; reconcile() returns
// ok:true / zero orphans on the live repo; reconcile() flags a synthetic orphan.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  loadContract,
  discoverValidators,
  reconcile,
  CONTRACT_PATH,
} = require('../scripts/global/validator-dispatch-contract.js');

const REPO_ROOT = path.join(__dirname, '..');
// worktree-naming-advisory was in this set until #3811 retired it (Epic #3807 C3) — its property
// is strictly dominated by the blocking validate-branch-name.sh + branch-name.yml gates.
const PREVIOUSLY_ORPHANED = [
  'fleet-review-required',
  'registry-tuple-coverage',
  'sub-issue-preference',
];

describe('validator-dispatch-contract', () => {
  describe('loadContract()', () => {
    it('loads the contract JSON without error', () => {
      const contract = loadContract(CONTRACT_PATH);
      assert.ok(contract, 'contract must be truthy');
      assert.ok(Array.isArray(contract.validators), 'validators must be an array');
      assert.ok(contract.validators.length > 0, 'validators array must be non-empty');
    });

    it('every contract entry has a non-empty validator name and file', () => {
      const contract = loadContract(CONTRACT_PATH);
      for (const entry of contract.validators) {
        assert.ok(
          entry.validator && entry.validator.length > 0,
          `entry missing validator name: ${JSON.stringify(entry)}`
        );
        assert.ok(
          entry.file && entry.file.length > 0,
          `entry missing file: ${entry.validator}`
        );
      }
    });

    it('every contract entry has a non-empty dispatchedBy array', () => {
      const contract = loadContract(CONTRACT_PATH);
      for (const entry of contract.validators) {
        assert.ok(
          Array.isArray(entry.dispatchedBy) && entry.dispatchedBy.length > 0,
          `validator '${entry.validator}' has empty or missing dispatchedBy`
        );
      }
    });

    it('throws when the contract file path does not exist', () => {
      assert.throws(
        () => loadContract('/nonexistent/path/contract.json'),
        /not found/i
      );
    });
  });

  describe('discoverValidators()', () => {
    it('discovers at least 40 validators in the live repo', () => {
      const discovered = discoverValidators(REPO_ROOT);
      assert.ok(
        discovered.length >= 40,
        `expected >=40 validators, got ${discovered.length}`
      );
    });

    it('every discovered entry has a name and file path', () => {
      const discovered = discoverValidators(REPO_ROOT);
      for (const validatorInfo of discovered) {
        assert.ok(validatorInfo.name, 'discovered entry must have name');
        assert.ok(validatorInfo.file, 'discovered entry must have file');
      }
    });

    it('does not include helper files in the discovered set', () => {
      const discovered = discoverValidators(REPO_ROOT);
      const helperNames = [
        'index',
        'artifact-field-extract',
        'doc-coverage-helpers',
        'work-log-sync-helpers',
        'epic-parent-resolve',
        'signer-registry-check',
        'doc-coverage-diff-replay-eval',
        'doc-coverage-diff-verify',
      ];
      const names = new Set(discovered.map(entry => entry.name));
      for (const helperName of helperNames) {
        assert.ok(
          !names.has(helperName),
          `helper '${helperName}' must not appear in discovered validators`
        );
      }
    });

    it('throws when megalint directory does not exist', () => {
      assert.throws(
        () => discoverValidators('/nonexistent/repo/root'),
        /not found/i
      );
    });
  });

  describe('reconcile() — live repo (zero orphans)', () => {
    it('returns ok:true with zero orphans on current repo state', () => {
      const contract = loadContract(CONTRACT_PATH);
      const discovered = discoverValidators(REPO_ROOT);
      const result = reconcile(contract, discovered);
      assert.strictEqual(
        result.ok,
        true,
        `reconcile must report ok:true; orphans: ${JSON.stringify(result.orphans)}`
      );
      assert.strictEqual(result.orphans.length, 0, 'zero orphans expected');
    });

    it('the 4 formerly-orphaned validators are now wired', () => {
      const contract = loadContract(CONTRACT_PATH);
      const contractMap = new Map(
        contract.validators.map(entry => [entry.validator, entry.dispatchedBy])
      );
      for (const validatorName of PREVIOUSLY_ORPHANED) {
        const dispatchedBy = contractMap.get(validatorName);
        assert.ok(
          Array.isArray(dispatchedBy) && dispatchedBy.length > 0,
          `'${validatorName}' must have a non-empty dispatchedBy in contract`
        );
      }
    });

    it('the 4 formerly-orphaned validators appear in megalint VALIDATORS map', () => {
      const { VALIDATORS } = require('../scripts/global/megalint/index.js');
      for (const validatorName of PREVIOUSLY_ORPHANED) {
        assert.ok(
          Object.prototype.hasOwnProperty.call(VALIDATORS, validatorName),
          `'${validatorName}' must be registered in megalint VALIDATORS map`
        );
        assert.strictEqual(
          typeof VALIDATORS[validatorName].validate,
          'function',
          `'${validatorName}' must expose a validate() function`
        );
      }
    });
  });

  describe('reconcile() — synthetic orphan detection', () => {
    it('flags a validator missing from contract as an orphan', () => {
      const contract = loadContract(CONTRACT_PATH);
      const syntheticValidator = { name: 'synthetic-orphan-test', file: 'scripts/global/megalint/synthetic-orphan-test.js' };
      const discovered = [syntheticValidator];
      const result = reconcile(contract, discovered);
      assert.strictEqual(result.ok, false, 'must return ok:false when orphan exists');
      assert.ok(result.orphans.length > 0, 'orphans array must be non-empty');
      const orphanNames = result.orphans.map(orphan => orphan.validator);
      assert.ok(
        orphanNames.includes('synthetic-orphan-test'),
        'synthetic orphan must appear in orphans list'
      );
    });

    it('flags a contract entry with empty dispatchedBy as an orphan', () => {
      const syntheticContract = {
        validators: [
          { validator: 'empty-dispatch-validator', file: 'scripts/global/megalint/empty-dispatch-validator.js', dispatchedBy: [] },
        ],
      };
      const discovered = [
        { name: 'empty-dispatch-validator', file: 'scripts/global/megalint/empty-dispatch-validator.js' },
      ];
      const result = reconcile(syntheticContract, discovered);
      assert.strictEqual(result.ok, false, 'empty dispatchedBy must produce ok:false');
      assert.strictEqual(result.orphans.length, 1);
      assert.strictEqual(result.orphans[0].validator, 'empty-dispatch-validator');
      assert.strictEqual(result.orphans[0].reason, 'empty-dispatchedBy');
    });

    it('returns contractOnly entries for validators in contract but not on disk', () => {
      const syntheticContract = {
        validators: [
          { validator: 'ghost-validator', file: 'scripts/global/megalint/ghost-validator.js', dispatchedBy: ['megalint-runAll'] },
        ],
      };
      const discovered = [];
      const result = reconcile(syntheticContract, discovered);
      assert.ok(result.contractOnly.length > 0, 'contractOnly must list ghost validators');
      assert.strictEqual(result.contractOnly[0].validator, 'ghost-validator');
    });
  });
});
