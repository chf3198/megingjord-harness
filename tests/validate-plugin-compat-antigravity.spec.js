const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const VALIDATOR_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'validate-plugin-compat.js'),
  'utf8');

test('validate-plugin-compat.js includes antigravity-plugin path', () => {
  assert.match(VALIDATOR_SRC, /\.antigravity-plugin\/plugin\.json/,
    'antigravity-plugin path must be in the validation-paths array');
});

test('validate-plugin-compat.js retains existing platform paths', () => {
  assert.match(VALIDATOR_SRC, /\.claude-plugin\/plugin\.json/);
  assert.match(VALIDATOR_SRC, /\.github\/plugin\/plugin\.json/);
});

test('validation-paths array enumerates all three platforms', () => {
  const m = VALIDATOR_SRC.match(/\['([^']+)',\s*'([^']+)',\s*'([^']+)'\]/);
  assert.ok(m, 'expected three-element string array');
  const paths = [m[1], m[2], m[3]];
  assert.deepStrictEqual(paths.sort(), [
    '.antigravity-plugin/plugin.json',
    '.claude-plugin/plugin.json',
    '.github/plugin/plugin.json',
  ]);
});
