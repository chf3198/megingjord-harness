'use strict';

const { test, expect } = require('@playwright/test');
const { validate, parseBlocks } = require('../scripts/global/decisions-md-validator.js');

const VALID = `# Decisions Log

## 2026-05-15 — D-0001: First decision

- **Status**: accepted
- **Decided-by**: Orla Mason
- **Team-context**: claude-code
- **Surface**: Issue #1636
- **Decision**: Adopt the pattern.
- **Why**: Portable fallback.

## 2026-05-16 — D-0002: Second decision

- **Status**: accepted
- **Decided-by**: Orla Mason
- **Team-context**: claude-code
- **Surface**: Issue #1670
- **Decision**: Add the validator.
- **Why**: Schema enforcement.
`;

test('validate accepts a well-formed decisions.md', () => {
  const result = validate(VALID);
  expect(result.ok).toBe(true);
  expect(result.blocks).toBe(2);
});

test('validate rejects missing required field', () => {
  const broken = VALID.replace('- **Why**: Portable fallback.', '');
  const result = validate(broken);
  expect(result.ok).toBe(false);
  expect(result.violations.some(v => v.includes('missing-why'))).toBe(true);
});

test('validate rejects non-monotonic IDs', () => {
  const broken = VALID.replace('D-0002', 'D-0001');
  const result = validate(broken);
  expect(result.ok).toBe(false);
  expect(result.violations.some(v => v.includes('non-monotonic'))).toBe(true);
});

test('parseBlocks finds all top-level decision headers', () => {
  const blocks = parseBlocks(VALID);
  expect(blocks).toHaveLength(2);
  expect(blocks[0].id).toBe('D-0001');
  expect(blocks[1].id).toBe('D-0002');
});

test('validate rejects empty file', () => {
  const result = validate('# Decisions Log\n\nNo blocks yet.\n');
  expect(result.ok).toBe(false);
  expect(result.violations).toContain('no-blocks-found');
});
