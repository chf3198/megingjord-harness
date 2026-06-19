'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { clip } = require('../scripts/global/output-clipper.js');

test('clip is a no-op under the line budget (lossless)', () => {
  const text = 'a\nb\nc';
  assert.equal(clip(text, { maxLines: 60 }), text);
});

test('clip keeps head + tail and elides the middle when over budget', () => {
  const text = Array.from({ length: 200 }, (_, i) => `line${i}`).join('\n');
  const out = clip(text, { maxLines: 60, head: 5, tail: 5 });
  assert.ok(out.includes('line0'), 'keeps head');
  assert.ok(out.includes('line199'), 'keeps tail');
  assert.ok(out.includes('elided'), 'marks elision');
  assert.ok(out.split('\n').length < 200, 'fewer lines than input');
});

test('clip keeps lines matching the match pattern', () => {
  const text = Array.from({ length: 200 }, (_, i) =>
    i === 100 ? 'IMPORTANT MATCH' : `line${i}`
  ).join('\n');
  const out = clip(text, { maxLines: 30, head: 2, tail: 2, match: 'IMPORTANT' });
  assert.ok(out.includes('IMPORTANT MATCH'), 'keeps matched line');
});

test('clip is idempotent once under budget', () => {
  const text = Array.from({ length: 200 }, (_, i) => `line${i}`).join('\n');
  const once = clip(text, { maxLines: 60 });
  assert.equal(clip(once, { maxLines: 60 }), once);
});

test('clip returns non-string input unchanged (graceful)', () => {
  assert.equal(clip(null), null);
  assert.deepEqual(clip(42), 42);
});
