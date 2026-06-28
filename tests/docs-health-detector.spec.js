// tests/docs-health-detector.spec.js — #3298 (source audit #3296 AC4).
// Strategy: tdd-pyramid. Covers owner resolution, orphan detection, freshness
// classification, the unmapped Tier-2 path, and emit — all via injected corpus /
// haystack / ageDaysFor so no git or filesystem-of-record call is made.
// node:test style (pure unit; no browser) so the split-test-runner + collaborator
// preflight `node --test` path both run it.
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dh = require('../scripts/global/docs-health-detector');

// A minimal owner map written to a temp file, used by every scan-level test.
function mkConfig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-health-'));
  const file = path.join(dir, 'owners.yml');
  fs.writeFileSync(file, [
    'version: 1', 'surfaces:',
    '  - glob: README.md', '    owner: admin', '    freshness_window: 30d',
    '  - glob: docs/howto/**', '    owner: collaborator', '    freshness_window: 90d',
    '  - glob: docs/decisions/**', '    owner: consultant', '    freshness_window: none',
    'orphan_exempt:', '  - README.md',
  ].join('\n'));
  return file;
}

// ── globToRegExp ──

test('glob ** matches any depth; * stays within a segment', () => {
  assert.strictEqual(dh.globToRegExp('docs/howto/**').test('docs/howto/a/b.md'), true);
  assert.strictEqual(dh.globToRegExp('docs/howto/**').test('docs/howto/x.md'), true);
  assert.strictEqual(dh.globToRegExp('README.md').test('README.md'), true);
  assert.strictEqual(dh.globToRegExp('README.md').test('docs/README.md'), false);
});

// ── resolveSurface ──

test('resolveSurface: first matching glob wins; unmapped returns owner null', () => {
  const { surfaces } = dh.loadOwners(mkConfig());
  assert.strictEqual(dh.resolveSurface('docs/howto/x.md', surfaces).owner, 'collaborator');
  assert.strictEqual(dh.resolveSurface('README.md', surfaces).owner, 'admin');
  assert.strictEqual(dh.resolveSurface('docs/orphans/lost.md', surfaces).owner, null);
});

// ── buildReferencedSet (orphan graph) ──

test('buildReferencedSet recognizes bare path mentions and wikilinks, excludes self', () => {
  const corpus = ['docs/howto/a.md', 'docs/howto/b.md', 'docs/howto/c.md'];
  const haystack = [
    { path: 'docs/howto/a.md', text: 'see docs/howto/b.md and [[c]]' },
    { path: 'docs/howto/b.md', text: 'leaf — mentions only itself docs/howto/b.md' },
    { path: 'README.md', text: 'index' },
  ];
  const ref = dh.buildReferencedSet(corpus, haystack);
  assert.strictEqual(ref.has('docs/howto/b.md'), true); // cited by a (self-mention in b excluded)
  assert.strictEqual(ref.has('docs/howto/c.md'), true); // wikilink from a
  assert.strictEqual(ref.has('docs/howto/a.md'), false); // referenced by no one → orphan
});

test('buildReferencedSet resolves a relative markdown link against the citing file dir', () => {
  // regression: a doc linked ONLY via a sibling relative link `](target.md)` must not
  // be a false orphan (the docs-health.md ← doc-update-trigger-matrix.md case).
  const corpus = ['docs/howto/index.md', 'docs/howto/target.md'];
  const haystack = [{ path: 'docs/howto/index.md', text: 'see [target](target.md)' }];
  const ref = dh.buildReferencedSet(corpus, haystack);
  assert.strictEqual(ref.has('docs/howto/target.md'), true);
});

// ── scan: orphan + freshness + unmapped ──

function fixtureScan(overrides = {}) {
  const corpus = ['README.md', 'docs/howto/guide.md', 'docs/howto/lonely.md'];
  const haystack = [
    { path: 'README.md', text: 'home → docs/howto/guide.md' },
    { path: 'docs/howto/guide.md', text: 'content' },
    { path: 'docs/howto/lonely.md', text: 'no inbound links' },
  ];
  const ages = { 'README.md': 5, 'docs/howto/guide.md': 200, 'docs/howto/lonely.md': 10 };
  return dh.scan({
    configPath: mkConfig(), corpus,
    haystack, ageDaysFor: (rel) => ages[rel], ...overrides,
  });
}

test('scan flags an orphan doc (no inbound reference, not exempt)', () => {
  const { docs } = fixtureScan();
  assert.strictEqual(docs.find((d) => d.path === 'docs/howto/lonely.md').orphan, true);
  assert.strictEqual(docs.find((d) => d.path === 'README.md').orphan, false); // exempt
  assert.strictEqual(docs.find((d) => d.path === 'docs/howto/guide.md').orphan, false); // referenced
});

test('scan flags a stale doc past its freshness window; archival/none is exempt', () => {
  const { docs, metrics } = fixtureScan();
  assert.strictEqual(docs.find((d) => d.path === 'docs/howto/guide.md').stale, true); // 200d > 90d
  assert.strictEqual(docs.find((d) => d.path === 'README.md').stale, false); // 5d < 30d
  assert.strictEqual(metrics.stale_count, 1);
});

test('scan marks an unmapped doc and metrics count it', () => {
  const { docs, metrics } = fixtureScan({ corpus: ['docs/elsewhere/x.md'],
    haystack: [{ path: 'README.md', text: 'docs/elsewhere/x.md' }], ageDaysFor: () => 1 });
  assert.strictEqual(docs[0].unmapped, true);
  assert.strictEqual(metrics.unmapped_count, 1);
});

// ── classify ──

test('classify: unmapped is Tier-2; orphan/stale are advisory; clean is ok', () => {
  assert.strictEqual(dh.classify({ total: 1, orphan_count: 0, stale_count: 0, unmapped_count: 2 }).level, 'tier-2');
  assert.strictEqual(dh.classify({ total: 1, orphan_count: 1, stale_count: 0, unmapped_count: 0 }).level, 'advisory');
  assert.strictEqual(dh.classify({ total: 1, orphan_count: 0, stale_count: 0, unmapped_count: 0 }).level, 'ok');
});

// ── emit ──

test('emit writes a schema-v3 G8 docs-health event', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ev-')), 'events.jsonl');
  const ev = dh.emit({ total: 3, orphan_count: 1, stale_count: 1, unmapped_count: 0 },
    { level: 'advisory', pattern_id: null }, '2026-06-28T00:00:00Z', file);
  assert.strictEqual(ev.version, 3);
  assert.strictEqual(ev.service, 'docs-health');
  assert.strictEqual(ev.goal, 'G8');
  const written = JSON.parse(fs.readFileSync(file, 'utf8').trim());
  assert.strictEqual(written.event, 'docs-health-check');
});
