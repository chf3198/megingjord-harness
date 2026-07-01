'use strict';
// tdd-pyramid spec for #2686 (Epic #2399 AC5) — advisory pre-commit check that
// flags newly-ADDED operator-memory feedback_*.md files.

const test = require('node:test');
const assert = require('node:assert');

const {
  check,
  findNewFeedbackMemory,
  isFeedbackMemoryPath,
  PROMOTION_HINT,
} = require('../scripts/global/feedback-memory-promotion-check.js');

test('AC1: flags a newly-added feedback memory file under a memory dir', () => {
  const nameStatus = 'A\t.claude/projects/x/memory/feedback_new_rule.md';
  const result = check({ nameStatus });
  assert.strictEqual(result.advisory, true);
  assert.deepStrictEqual(result.files, ['.claude/projects/x/memory/feedback_new_rule.md']);
  assert.strictEqual(result.hint, PROMOTION_HINT);
});

test('AC2: advisory result is always ok (non-blocking)', () => {
  const result = check({ nameStatus: 'A\tmemory/feedback_a.md' });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.advisory, true);
});

test('AC3: modified (M-status) feedback memory file does NOT fire (idempotent)', () => {
  const nameStatus = 'M\t.claude/memory/feedback_existing.md';
  const result = check({ nameStatus });
  assert.strictEqual(result.advisory, false);
  assert.deepStrictEqual(result.files, []);
});

test('AC3: pre-existing / renamed status does NOT fire', () => {
  const nameStatus = 'R100\told/memory/feedback_a.md\tnew/memory/feedback_a.md';
  const result = check({ nameStatus });
  assert.strictEqual(result.advisory, false);
});

test('precision: a new feedback_*.md OUTSIDE a memory dir does NOT fire', () => {
  const result = check({ nameStatus: 'A\tresearch/feedback_note.md' });
  assert.strictEqual(result.advisory, false);
});

test('precision: a new non-feedback file in a memory dir does NOT fire', () => {
  const result = check({ nameStatus: 'A\tmemory/MEMORY.md' });
  assert.strictEqual(result.advisory, false);
});

test('multiple new feedback memory files are all reported', () => {
  const nameStatus = ['A\tmemory/feedback_one.md', 'A\t.claude/x/memory/feedback_two.md'].join('\n');
  const result = check({ nameStatus });
  assert.strictEqual(result.files.length, 2);
});

test('env bypass short-circuits to non-advisory', () => {
  const prev = process.env.FEEDBACK_MEMORY_CHECK_BYPASS;
  process.env.FEEDBACK_MEMORY_CHECK_BYPASS = '1';
  try {
    const result = check({ nameStatus: 'A\tmemory/feedback_x.md' });
    assert.strictEqual(result.skipped, 'env-bypass');
    assert.strictEqual(result.advisory, false);
  } finally {
    if (prev === undefined) delete process.env.FEEDBACK_MEMORY_CHECK_BYPASS;
    else process.env.FEEDBACK_MEMORY_CHECK_BYPASS = prev;
  }
});

test('isFeedbackMemoryPath: unit matrix', () => {
  assert.strictEqual(isFeedbackMemoryPath('memory/feedback_a.md'), true);
  assert.strictEqual(isFeedbackMemoryPath('a/b/memory/feedback_a.md'), true);
  assert.strictEqual(isFeedbackMemoryPath('.claude/p/memory/feedback_a.md'), true);
  assert.strictEqual(isFeedbackMemoryPath('research/feedback_a.md'), false);
  assert.strictEqual(isFeedbackMemoryPath('memory/notes.md'), false);
  assert.strictEqual(isFeedbackMemoryPath('memory/feedback_a.txt'), false);
});

test('findNewFeedbackMemory: empty / undefined input is safe', () => {
  assert.deepStrictEqual(findNewFeedbackMemory(''), []);
  assert.deepStrictEqual(findNewFeedbackMemory(undefined), []);
});
