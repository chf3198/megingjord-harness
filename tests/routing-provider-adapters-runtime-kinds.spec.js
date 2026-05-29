const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ADAPTERS = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'global', 'routing-provider-adapters.json'),
  'utf8'));

test('runtimeKinds contains all four supported runtimes (claude-code, codex, copilot, antigravity)', () => {
  const expected = ['antigravity', 'claude-code', 'codex', 'copilot'];
  for (const kind of expected) {
    assert.ok(ADAPTERS.runtimeKinds.includes(kind),
      `runtimeKinds must include "${kind}" — found: ${JSON.stringify(ADAPTERS.runtimeKinds)}`);
  }
});

test('runtimeKinds is sorted alphabetically (canonical form)', () => {
  const sorted = [...ADAPTERS.runtimeKinds].sort();
  assert.deepStrictEqual(ADAPTERS.runtimeKinds, sorted,
    'runtimeKinds should be sorted alphabetically for deterministic diffs');
});

test('Antigravity runtime kind is canonical lowercase string (matches signer registry)', () => {
  assert.ok(ADAPTERS.runtimeKinds.includes('antigravity'),
    'antigravity must be lowercase to match inventory/team-model-signatures.json team-string');
});
