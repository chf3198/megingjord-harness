'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { compileDoc } = require('../scripts/wiki/compile-doc.js');
const {
  staleEntries,
  residentDocPreloads,
  sha256Hex,
} = require('../scripts/global/doc-plane-boundary-lint.js');

test('compileDoc emits a sparse entry with provenance + outline', () => {
  const text = '# My Doc\n\nLead paragraph here.\n\n## Section A\nbody\n\n## Section B\nmore\n';
  const record = compileDoc('docs/howto/my-doc.md', text);
  assert.equal(record.title, 'My Doc');
  assert.deepEqual(record.outline, ['Section A', 'Section B']);
  assert.match(record.body, /source_path: "docs\/howto\/my-doc.md"/);
  assert.match(record.body, /source_sha256: [0-9a-f]{64}/);
  assert.match(record.body, /content_hash: [0-9a-f]{64}/);
  assert.match(record.body, /read this, not the raw doc/);
});

test('compileDoc is deterministic (same input -> same hash)', () => {
  const text = '# T\n\nlead\n\n## H\n';
  assert.equal(compileDoc('a.md', text).contentHash, compileDoc('a.md', text).contentHash);
});

test('staleEntries flags a compiled entry whose source changed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compiled-'));
  const srcRel = 'tmp-src.md';
  const compiled = `---\nsource_path: "${srcRel}"\nsource_sha256: ${sha256Hex('OLD CONTENT')}\n---\n# x\n`;
  fs.writeFileSync(path.join(dir, 'entry.md'), compiled);
  // create the live source with DIFFERENT content at repo root
  const root = path.resolve(__dirname, '..');
  fs.writeFileSync(path.join(root, srcRel), 'NEW CONTENT');
  const stale = staleEntries(dir);
  fs.unlinkSync(path.join(root, srcRel));
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(stale.length, 1, 'one stale entry flagged');
});

test('residentDocPreloads returns an array (no docs/** preload in resident set)', () => {
  assert.ok(Array.isArray(residentDocPreloads()));
});
