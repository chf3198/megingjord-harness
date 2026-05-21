'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { validate } = require('../scripts/global/validate-config-schemas');

const ROOT = path.resolve(__dirname, '..');

test('canonical .claude/settings.json passes schema validation', () => {
  const file = path.join(ROOT, '.claude', 'settings.json');
  const schema = path.join(ROOT, 'config', 'claude-code-settings.schema.json');
  const result = validate(file, schema);
  assert.equal(result.ok, true, `Validation failed: ${result.error}`);
});

test('flat-hook-entry regression fixture fails validation with clear error', () => {
  const file = path.join(ROOT, 'tests', 'fixtures', 'flat_hook_settings.json');
  const schema = path.join(ROOT, 'config', 'claude-code-settings.schema.json');
  const result = validate(file, schema);
  assert.equal(result.ok, false);
  assert.match(result.error, /ValidationError|Additional properties|unexpected/);
});
