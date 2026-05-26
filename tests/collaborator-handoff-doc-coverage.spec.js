// Refs #2154 - tests for Tech-Writer sub-phase doc-coverage advisory
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkDocCoverageAdvisory } = require('../scripts/global/megalint/collaborator-handoff.js');

test('checkDocCoverageAdvisory: emits advisory when doc-coverage missing on lane:code-change', () => {
  const result = checkDocCoverageAdvisory('## COLLABORATOR_HANDOFF\nbody no doc-coverage here', 'lane:code-change');
  assert.equal(result.length, 1);
  assert.equal(result[0].rule, 'doc-coverage-advisory');
  assert.equal(result[0].severity, 'advisory');
});

test('checkDocCoverageAdvisory: silent when doc-coverage block present', () => {
  const body = '## COLLABORATOR_HANDOFF\n\ndoc-coverage:\n  UPDATED: README.md\n';
  assert.deepEqual(checkDocCoverageAdvisory(body, 'lane:code-change'), []);
});

test('checkDocCoverageAdvisory: silent on lightweight lanes', () => {
  assert.deepEqual(checkDocCoverageAdvisory('no coverage', 'lane:docs-research'), []);
  assert.deepEqual(checkDocCoverageAdvisory('no coverage', 'lane:docs-only'), []);
  assert.deepEqual(checkDocCoverageAdvisory('no coverage', 'lane:trivial'), []);
  assert.deepEqual(checkDocCoverageAdvisory('no coverage', 'lane:config-only'), []);
});

test('checkDocCoverageAdvisory: regex case-insensitive', () => {
  const body = '## COLLABORATOR_HANDOFF\nDOC-COVERAGE: present';
  assert.deepEqual(checkDocCoverageAdvisory(body, 'lane:code-change'), []);
});
