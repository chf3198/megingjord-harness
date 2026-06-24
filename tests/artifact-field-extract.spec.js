// artifact-field-extract tests — #3225 AC4: shared helper must be a strict
// superset of both pre-#3030 regexes (manager-handoff + baton-schema-preflight).
'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const { extractField } = require(
  path.resolve(__dirname, '..', 'scripts', 'global', 'megalint', 'artifact-field-extract')
);

// --- Plain field: (all pre-#3030 regexes supported this) ---
test('plain field: value', () => {
  expect(extractField('scope: fix widget', 'scope')).toBe('fix widget');
});

// --- List-prefixed: `- field:` (old preflight regex, AC4 gap) ---
test('hyphen list prefix: - field:', () => {
  expect(extractField('- scope: fix widget', 'scope')).toBe('fix widget');
});

// --- List-prefixed: `* field:` ---
test('asterisk list prefix: * field:', () => {
  expect(extractField('* scope: fix widget', 'scope')).toBe('fix widget');
});

// --- Heading prefix: `## field:` (merged helper supported this) ---
test('heading prefix: ## field:', () => {
  expect(extractField('## scope: fix widget', 'scope')).toBe('fix widget');
});

// --- Bold-markdown: `**field:**` (#3030 F-BC1) ---
test('bold-markdown: **field:**', () => {
  expect(extractField('**test_strategy:** tdd-pyramid', 'test_strategy'))
    .toBe('tdd-pyramid');
});

// --- Colon-outside-bold: `**field**:` (AC4 gap) ---
test('colon-outside-bold: **field**:', () => {
  expect(extractField('**test_strategy**: tdd-pyramid', 'test_strategy'))
    .toBe('tdd-pyramid');
});

// --- Multi-line body (field on non-first line) ---
test('field on non-first line', () => {
  const body = '## MANAGER_HANDOFF\nscope: refactor\nlane: lane:code-change';
  expect(extractField(body, 'lane')).toBe('lane:code-change');
});

// --- Null on missing field ---
test('returns null when field is absent', () => {
  expect(extractField('scope: something', 'lane')).toBeNull();
});

// --- Null/empty body resilience ---
test('returns null on null body', () => {
  expect(extractField(null, 'scope')).toBeNull();
});

test('returns null on empty string body', () => {
  expect(extractField('', 'scope')).toBeNull();
});

// --- Case insensitivity ---
test('case-insensitive match', () => {
  expect(extractField('SCOPE: upper case', 'scope')).toBe('upper case');
});

// --- Strips trailing bold markers from value ---
test('strips trailing ** from value', () => {
  expect(extractField('**scope:** value**', 'scope')).toBe('value');
});
