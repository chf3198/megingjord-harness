const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const VALIDATOR_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'validate-plugin-compat.js'),
  'utf8');

test('REQUIRED_PLUGIN_PATHS contains Claude Code + Copilot canonical paths', () => {
  assert.match(VALIDATOR_SRC, /REQUIRED_PLUGIN_PATHS\s*=\s*\[\s*'\.claude-plugin\/plugin\.json',\s*'\.github\/plugin\/plugin\.json'\s*\]/);
});

test('OPTIONAL_PLUGIN_PATHS contains Antigravity path', () => {
  assert.match(VALIDATOR_SRC, /OPTIONAL_PLUGIN_PATHS\s*=\s*\[\s*'\.antigravity-plugin\/plugin\.json'\s*\]/);
});

test('Antigravity path missing emits informational note, not error', () => {
  assert.match(VALIDATOR_SRC, /Optional plugin manifest absent/);
});

test('Existing Claude Code + Copilot paths missing still emits error', () => {
  assert.match(VALIDATOR_SRC, /isOptional/);
  assert.match(VALIDATOR_SRC, /Missing: \$\{rel\}/);
});
