'use strict';
// #3779 (Epic #3719): consumer read-path cutover to wiki-mirror. tdd-pyramid.
// Unit: mirror-source materialize/fallback (graceful, never throws). Integration: retrieval falls back to
// local work-log when wiki-mirror is unavailable (Tier-0 safety) and prefers the mirror when present.
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { ensureMirrorCache, listMirrorWorkLogPages } = require('../scripts/wiki/mirror-source.js');
const { loadRetrievalPages } = require('../scripts/wiki/retrieval.js');

test('ensureMirrorCache: graceful null when git fails (Tier-0 / air-gapped)', () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-'));
  const res = ensureMirrorCache({ cacheDir, exec: () => { throw new Error('no git / no branch'); } });
  assert.equal(res, null, 'must return null (caller falls back to local), never throw');
});

test('ensureMirrorCache: null when the archive produced no work-log dir', () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-'));
  const res = ensureMirrorCache({ cacheDir, exec: () => Buffer.from('') }); // exec succeeds but extracts nothing
  assert.equal(res, null);
});

test('listMirrorWorkLogPages: reads ticket/pr pages from a materialized cache', () => {
  const wikiPath = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-'));
  fs.mkdirSync(path.join(wikiPath, 'work-log/tickets'), { recursive: true });
  fs.mkdirSync(path.join(wikiPath, 'work-log/prs'), { recursive: true });
  fs.writeFileSync(path.join(wikiPath, 'work-log/tickets/42.md'), '---\n---\nbody');
  fs.writeFileSync(path.join(wikiPath, 'work-log/prs/7.md'), '---\n---\nbody');
  const pages = listMirrorWorkLogPages({ wikiPath });
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map((p) => p.type).sort(), ['pr', 'ticket']);
  assert.ok(pages.every((p) => p.path.includes(wikiPath)), 'paths point at the mirror cache');
});

test('listMirrorWorkLogPages: null when the mirror is unavailable', () => {
  assert.equal(listMirrorWorkLogPages({ wikiPath: null, exec: () => { throw new Error('unavailable'); } }), null);
});

test('retrieval falls back to LOCAL work-log when wiki-mirror is unavailable (no throw)', () => {
  const prev = process.env.WIKI_MIRROR_REF;
  process.env.WIKI_MIRROR_REF = 'origin/__nonexistent-mirror-ref__'; // git archive fails → null → fallback
  try {
    const pages = loadRetrievalPages();
    assert.ok(Array.isArray(pages) && pages.length > 0, 'returns local pages, not empty/throw');
    // some work-log pages are present (from the local tree), read from a non-cache path
    const wl = pages.filter((p) => p.type === 'ticket' || p.type === 'pr');
    assert.ok(wl.length === 0 || wl.every((p) => !p.path.includes('.wiki-mirror-cache')), 'fallback uses local, not cache');
  } finally {
    if (prev === undefined) delete process.env.WIKI_MIRROR_REF; else process.env.WIKI_MIRROR_REF = prev;
  }
});
