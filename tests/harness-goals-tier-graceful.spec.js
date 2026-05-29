const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'instructions', 'harness-goals.instructions.md'),
  'utf8');

test('Tier-graceful degradation pattern paragraph is present', () => {
  assert.match(SRC, /## Tier-graceful degradation \(cross-cutting pattern between G5 and G6\)/);
});

test('Pattern includes optimal-with-fallback statement', () => {
  assert.match(SRC, /SHOULD use that[\s\S]+resource when available AND MUST degrade gracefully/);
});

test('Pattern references MEGINGJORD_MINIMUM_TIER (Epic #2398)', () => {
  assert.match(SRC, /MEGINGJORD_MINIMUM_TIER/);
  assert.match(SRC, /Epic #2398/);
});

test('G5 paragraph cross-references the new pattern', () => {
  assert.match(SRC, /G5 covers baseline-absent resources for a given operator\.[\s\n]+See "Tier-graceful degradation"/);
});

test('G6 paragraph cross-references the new pattern', () => {
  assert.match(SRC, /G6 Resilience: graceful degradation and fallback paths for partial outages\.[\s\n]+See "Tier-graceful degradation"/);
});

test('Engineering-practice rule for tier-2-or-higher PRs is present', () => {
  assert.match(SRC, /tier-1 fallback[\s\S]+rejected at code review/);
});
