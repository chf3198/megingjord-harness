'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { route, ROUTES } = require('../scripts/global/memory-write-router.js');
const {
  normalizeKey,
  findDuplicates,
  longEntries,
} = require('../scripts/global/memory-dedup-lint.js');

test('route maps each fact-class to a single canonical home', () => {
  assert.equal(route('durable-pattern').home, 'wiki/wisdom/project/');
  assert.equal(route('operator-pref').private, true);
  assert.equal(route('rule').home, 'instructions/');
  assert.ok(Object.keys(ROUTES).length >= 8);
});

test('route flags an unknown fact-class', () => {
  const result = route('nonsense');
  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.known));
});

test('normalizeKey lowercases and strips punctuation', () => {
  assert.equal(normalizeKey('Foo-Bar: Baz!'), 'foo bar baz');
});

test('findDuplicates flags a key present in 2 surfaces', () => {
  const a = path.join(os.tmpdir(), `surf-a-${process.pid}.md`);
  const b = path.join(os.tmpdir(), `surf-b-${process.pid}.md`);
  fs.writeFileSync(a, '- [Shared Pattern](x.md) — hook\n');
  fs.writeFileSync(b, '- [Shared Pattern](y.md) — other\n');
  const dups = findDuplicates([a, b]);
  assert.equal(dups.length, 1, 'one duplicate key across the two surfaces');
  fs.unlinkSync(a);
  fs.unlinkSync(b);
});

test('longEntries flags over-budget bullet lines (learnings pointer budget)', () => {
  const tmp = path.join(os.tmpdir(), `learn-${process.pid}.md`);
  fs.writeFileSync(tmp, `- short pointer\n- ${'x'.repeat(300)}\n`);
  assert.equal(longEntries(tmp, 200).length, 1);
  assert.deepEqual(longEntries('/nonexistent.md', 200), []);
  fs.unlinkSync(tmp);
});
