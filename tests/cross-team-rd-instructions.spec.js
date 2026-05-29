const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'instructions', 'cross-team-rd-synthesis.instructions.md'),
  'utf8');

test('v3 references dispatcher Phase-0 conclusion (#2393)', () => {
  assert.match(SRC, /#2393/);
  assert.match(SRC, /\.gnap\/dispatch\/<team>\/<ts>\.json/);
});

test('v3 references admin rotation Phase-0 conclusion (#2394)', () => {
  assert.match(SRC, /#2394/);
  assert.match(SRC, /admin_team\s*=\s*teams\[ticket_N\s*%\s*len\(teams\)\]/);
});

test('v3 references fanout Phase-0 conclusion (#2395)', () => {
  assert.match(SRC, /#2395/);
  assert.match(SRC, /Per-team-MD scheme is canonical/);
});

test('v3 references termination Phase-0 conclusion (#2396)', () => {
  assert.match(SRC, /#2396/);
  assert.match(SRC, /K-S adaptive/);
  assert.match(SRC, /24h hard ceiling/);
});

test('v3 references tier-graceful pattern (#2400)', () => {
  assert.match(SRC, /#2400/);
  assert.match(SRC, /Tier-graceful degradation/);
});

test('v3 references A2A envelope wrapping', () => {
  assert.match(SRC, /Agent2Agent envelope|A2A protocol|A2A envelope/);
});

test('v3 references cross-team-response-fidelity validator (#2370)', () => {
  assert.match(SRC, /#2370/);
});

test('v2 source has SUPERSEDED-BY-v3 marker', () => {
  const v2 = fs.readFileSync(
    path.join(__dirname, '..', 'research', 'cross-team-rd-protocol-v2-2026-05-09.md'),
    'utf8');
  assert.match(v2, /SUPERSEDED-BY-v3/);
});
