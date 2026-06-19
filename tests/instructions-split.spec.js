'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const {
  classify,
  importedInstructions,
} = require('../scripts/global/instructions-split-classifier.js');
const { residentRepoFiles } = require('../scripts/global/resident-budget.js');

test('core-identity instructions classify resident (fail-open to governance)', () => {
  assert.equal(classify('role-baton-routing.instructions.md').classification, 'resident');
  assert.equal(classify('operator-identity-context.instructions.md').reason, 'core-identity');
});

test('situational reference instructions classify on-demand', () => {
  assert.equal(classify('visual-qa-governance.instructions.md').classification, 'on-demand');
  assert.equal(classify('playwright-mcp-low-resource.instructions.md').classification, 'on-demand');
});

test('unknown instruction with no file fails open to resident', () => {
  assert.equal(classify('nonexistent-xyz.instructions.md').classification, 'resident');
});

test('importedInstructions parses CLAUDE.md @-imports; situational removed, core kept', () => {
  const claudeMd = path.join(path.resolve(__dirname, '..'), 'CLAUDE.md');
  const imported = importedInstructions(claudeMd);
  assert.ok(imported.length > 0);
  assert.ok(
    !imported.includes('visual-qa-governance.instructions.md'),
    'situational moved off @-import'
  );
  assert.ok(imported.includes('role-baton-routing.instructions.md'), 'core stays @-imported');
});

test('residentRepoFiles counts only CLAUDE.md + its @-imports', () => {
  const files = residentRepoFiles();
  assert.ok(files.some((file) => file.endsWith('CLAUDE.md')));
  assert.ok(
    !files.some((file) => file.endsWith('visual-qa-governance.instructions.md')),
    'situational not resident'
  );
});
