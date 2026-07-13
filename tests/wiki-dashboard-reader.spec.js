'use strict';
// #3764 (Epic #3719): human browse/search + curation surface. tdd-pyramid. Deterministic fixture;
// curation tests write to a fresh tmp copy so the committed fixture is never mutated.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { test } = require('node:test');
const reader = require('../scripts/wiki/dashboard-reader.js');

const FIXTURE = path.join(__dirname, 'fixtures', 'wiki-3764', 'wiki');

function tmpWiki() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki3764-'));
  fs.cpSync(FIXTURE, path.join(dir, 'wiki'), { recursive: true });
  return path.join(dir, 'wiki');
}

test('AC1 browse spans A/B/C across both scopes', () => {
  const pages = reader.browseWiki({ wikiDir: FIXTURE });
  const types = new Set(pages.map((p) => p.type));
  const scopes = new Set(pages.map((p) => p.scope));
  assert.ok(types.has('A') && types.has('B') && types.has('C'), 'all three wiki types present');
  assert.ok(scopes.has('global') && scopes.has('workspace'), 'both scopes present');
});

test('AC1 browse filters by scope (global → only wisdom/global)', () => {
  const pages = reader.browseWiki({ wikiDir: FIXTURE, scope: 'global' });
  assert.ok(pages.length > 0);
  assert.ok(pages.every((p) => p.scope === 'global'));
});

test('AC1 browse filters by wikiType (work-log → only B)', () => {
  const pages = reader.browseWiki({ wikiDir: FIXTURE, wikiType: 'work-log' });
  assert.ok(pages.length > 0);
  assert.ok(pages.every((p) => p.type === 'B'));
});

test('AC1 search ranks by the lexical floor across scopes', () => {
  const hits = reader.searchWiki('login authentication token', { wikiDir: FIXTURE });
  assert.ok(hits.length > 0);
  const slugs = hits.map((h) => h.slug);
  assert.ok(slugs.includes('1234') || slugs.includes('auth-module'), 'a login-related page ranks in');
  assert.ok(hits[0].rank === 1, 'top hit carries rank 1');
});

test('AC1 search honours the scope filter', () => {
  const hits = reader.searchWiki('consensus receipt independence', { wikiDir: FIXTURE, scope: 'global' });
  assert.ok(hits.every((h) => h.scope === 'global'));
});

test('AC2 curate flag-stale routes through the validated write path + injects status:stale', () => {
  const wikiDir = tmpWiki();
  const res = reader.curatePage({ slug: 'consensus', type: 'concept', action: 'flag-stale', wikiDir, options: { allowExternalWikiDir: true } });
  assert.equal(res.via, 'wiki-io.writePage', 'curation goes through wiki-io#writePage, not a raw fs.write');
  assert.equal(res.ok, true);
  const written = fs.readFileSync(res.path, 'utf-8');
  assert.match(written, /status:\s*stale/);
});

test('AC2 curate edit redacts credential-class secrets on the write path (no schema bypass)', () => {
  const wikiDir = tmpWiki();
  const secret = ['---', 'title: "leak"', 'type: concept', 'content_trust_score: 1.0',
    'created: "2026-07-01"', 'updated: "2026-07-01"', '---',
    `sk-ant-api03-${'A'.repeat(80)}-${'B'.repeat(8)}`].join('\n');
  const res = reader.curatePage({ slug: 'leaktest', type: 'concept', action: 'edit', content: secret, wikiDir, options: { allowExternalWikiDir: true } });
  const written = fs.readFileSync(res.path, 'utf-8');
  assert.match(written, /REDACTED/, 'secret scrubbed by the validated write path');
  assert.doesNotMatch(written, /sk-ant-api03-A{10}/, 'raw secret not present');
});

test('withFrontmatterFlag injects into existing frontmatter and creates one when absent', () => {
  const withFm = reader.withFrontmatterFlag('---\ntitle: "x"\n---\nbody', 'status', 'stale');
  assert.match(withFm, /status: stale/);
  assert.match(withFm.split('---')[1], /status: stale/, 'flag is inside the frontmatter block');
  const noFm = reader.withFrontmatterFlag('just body', 'status', 'stale');
  assert.match(noFm, /^---\nstatus: stale\n---/);
});
