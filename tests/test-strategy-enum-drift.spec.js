'use strict';
// #1236 — drift-detection spec: verify test-strategy-enum module stays in sync with matrix doc.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');

const ENUM_MODULE = path.resolve(__dirname, '../scripts/global/test-strategy-enum');

test('#1236 module exports required constants', () => {
  const { ALLOWED_STRATEGIES, NONE_PERMITTED_LANES, PEER_REVIEW_RUBRIC_THRESHOLD } = require(ENUM_MODULE);
  expect(Array.isArray(ALLOWED_STRATEGIES)).toBe(true);
  expect(ALLOWED_STRATEGIES.length).toBeGreaterThan(0);
  expect(ALLOWED_STRATEGIES).toContain('tdd-pyramid');
  expect(ALLOWED_STRATEGIES).toContain('none');
  expect(Array.isArray(NONE_PERMITTED_LANES)).toBe(true);
  expect(NONE_PERMITTED_LANES.length).toBeGreaterThan(0);
  expect(typeof PEER_REVIEW_RUBRIC_THRESHOLD).toBe('number');
  expect(PEER_REVIEW_RUBRIC_THRESHOLD).toBe(7);
});

test('#1236 drift: every module strategy appears in the matrix doc enum line', () => {
  const { ALLOWED_STRATEGIES } = require(ENUM_MODULE);
  const docPath = path.resolve(__dirname, '../instructions/test-methodology-matrix.instructions.md');
  const docText = fs.readFileSync(docPath, 'utf8');
  const enumLineMatch = docText.match(/##\s*Strategy enum[^\n]*\n+([^\n]+)/);
  expect(enumLineMatch, 'Could not find "## Strategy enum" section in doc').not.toBeNull();
  const docEnum = enumLineMatch[1];
  for (const strategy of ALLOWED_STRATEGIES) {
    expect(docEnum, `Strategy '${strategy}' missing from doc enum line — update instructions/test-methodology-matrix.instructions.md`).toContain(strategy);
  }
});
