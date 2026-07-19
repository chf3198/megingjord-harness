'use strict';
// Unit tests for the C4 resident-load budget + fail-closed on-demand loader (Epic #3807 / #3812).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const budget = require('../scripts/global/resident-load-budget.js');

test('checkBudget reports resident load within the committed baseline ceiling', () => {
  const status = budget.checkBudget();
  assert.ok(status.files >= 1, 'resident file set is non-empty (CLAUDE.md at minimum)');
  assert.ok(status.loc > 0, 'resident LOC is measured');
  assert.strictEqual(typeof status.budget, 'number', 'budget ceiling resolves to a number');
  assert.strictEqual(status.within, status.loc <= status.budget, 'within flag is consistent');
});

test('the migrated rule is NO LONGER in the always-resident set', () => {
  const residentFiles = budget.residentInstructionFiles();
  assert.ok(
    !residentFiles.some((rel) => rel.endsWith('resource-tier-portability.instructions.md')),
    'resource-tier-portability must be migrated out of the resident @-import set'
  );
});

test('the migrated rule IS reachable via fail-closed on-demand loading (rule kept, not lost)', () => {
  const rules = budget.requireForOperation('resource-tier-selection');
  assert.strictEqual(rules.length, 1);
  assert.strictEqual(rules[0].name, 'resource-tier-portability.instructions.md');
  assert.ok(rules[0].loaded === true && rules[0].loc > 0, 'rule content actually loaded');
});

test('loadOnDemand FAILS CLOSED (throws) when a migrated rule cannot be loaded — no silent skip', () => {
  assert.throws(
    () => budget.loadOnDemand('does-not-exist.instructions.md'),
    (err) => err instanceof budget.OnDemandLoadError,
    'a missing on-demand rule must throw OnDemandLoadError so the operation blocks'
  );
});

test('loadOnDemand FAILS CLOSED on an empty rule file (blocks rather than proceeding ruleless)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rlb-'));
  fs.writeFileSync(path.join(dir, 'empty.instructions.md'), '   \n  \n');
  assert.throws(
    () => budget.loadOnDemand('empty.instructions.md', dir),
    (err) => err instanceof budget.OnDemandLoadError,
    'an empty on-demand rule must throw so the operation blocks'
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('requireForOperation FAILS CLOSED on an unknown operation (no unguarded proceed)', () => {
  assert.throws(
    () => budget.requireForOperation('operation-with-no-mapping'),
    (err) => err instanceof budget.OnDemandLoadError
  );
});
