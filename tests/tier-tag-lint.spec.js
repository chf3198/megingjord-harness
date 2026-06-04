'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { impliedTier, lintFile } = require('../scripts/global/megalint/tier-tag-lint');

test('impliedTier: pure-local → 1 (baseline floor)', () => {
  assert.strictEqual(impliedTier('const x = 1; // nothing remote'), 1);
});
test('impliedTier: HAMR/workers → 2', () => {
  assert.strictEqual(impliedTier('fetch("https://x.workers.dev")'), 2);
});
test('impliedTier: tailscale/ollama → 3', () => {
  assert.strictEqual(impliedTier('const H="100.91.113.16:11434"'), 3);
});
test('impliedTier: paid provider key → 4', () => {
  assert.strictEqual(impliedTier('process.env.ANTHROPIC_API_KEY'), 4);
});

test('lintFile: tier>=2 resource without tag → missing-tier-tag', () => {
  const v = lintFile('a.js', 'fetch("https://x.workers.dev")');
  assert.strictEqual(v.length, 1);
  assert.strictEqual(v[0].rule, 'missing-tier-tag');
});
test('lintFile: tier>=2 resource with adequate tag → ok', () => {
  const v = lintFile('a.js', '// tier: 2\nfetch("https://x.workers.dev")');
  assert.strictEqual(v.length, 0);
});
test('lintFile: tag too low for implied tier → tier-tag-too-low', () => {
  const v = lintFile('a.js', '// tier: 2\nconst H="100.91.113.16:11434"');
  assert.strictEqual(v.length, 1);
  assert.strictEqual(v[0].rule, 'tier-tag-too-low');
});
test('lintFile: baseline script (tier 0 tag, no remote resource) → ok', () => {
  const v = lintFile('a.js', '// tier: 0\nconst x = 1;');
  assert.strictEqual(v.length, 0);
});
test('lintFile: untagged baseline script → ok (tier-1 default)', () => {
  const v = lintFile('a.js', 'const x = 1; // local only');
  assert.strictEqual(v.length, 0);
});
