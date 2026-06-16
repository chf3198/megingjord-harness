'use strict';
// #3046 (drift-lint): the tool-use reliability directives must remain present and
// correctly linked so Copilot cannot silently lose the anti-hallucination rules.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..');
const TOOL_RELIABILITY = path.join(ROOT, '.github', 'copilot-instructions-tool-reliability.md');
const ADVANCED = path.join(ROOT, '.github', 'copilot-instructions-advanced.md');
const AGENTS = path.join(ROOT, 'AGENTS.md');

test('directive file exists and is under 30 lines (#3046 AC)', () => {
  const lines = fs.readFileSync(TOOL_RELIABILITY, 'utf8').split('\n');
  // trailing newline produces one empty element — subtract it
  const count = lines.at(-1) === '' ? lines.length - 1 : lines.length;
  assert.ok(count <= 30, `Expected ≤30 lines, got ${count}`);
});

test('directive file explicitly forbids inventing issue IDs', () => {
  const text = fs.readFileSync(TOOL_RELIABILITY, 'utf8');
  assert.match(text, /NEVER invent a GitHub issue number/i);
});

test('directive file requires tool-read before authoring artifacts', () => {
  const text = fs.readFileSync(TOOL_RELIABILITY, 'utf8');
  assert.match(text, /gh issue view/);
  assert.match(text, /read_file/);
});

test('directive file forbids fabricating artifact content', () => {
  const text = fs.readFileSync(TOOL_RELIABILITY, 'utf8');
  assert.match(text, /fabricat/i);
});

test('advanced instructions link to tool-reliability file', () => {
  const text = fs.readFileSync(ADVANCED, 'utf8');
  assert.match(text, /copilot-instructions-tool-reliability\.md/);
});

test('AGENTS.md references tool-use reliability directives', () => {
  const text = fs.readFileSync(AGENTS, 'utf8');
  assert.match(text, /tool-use reliability/i);
  assert.match(text, /copilot-instructions-tool-reliability\.md/);
});
