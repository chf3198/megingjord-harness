'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const W = require('../scripts/wiki-metrics.js');

function tmpFile() {
  return path.join(os.tmpdir(), `wm-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

test('recordAccess: missing slug records section only', () => {
  const file = tmpFile();
  const result = W.recordAccess('concepts', null, { file });
  assert.equal(result.totalAccess, 1);
  assert.equal(result.sections.concepts, 1);
  assert.deepEqual(result.pages, {});
  fs.unlinkSync(file);
});

test('recordAccess: with slug populates pages map (AC1)', () => {
  const file = tmpFile();
  W.recordAccess('concepts', 'judge-quorum', { file });
  W.recordAccess('concepts', 'judge-quorum', { file });
  const result = W.recordAccess('concepts', 'hamr-routing', { file });
  assert.equal(result.totalAccess, 3);
  assert.equal(result.pages['judge-quorum'], 2);
  assert.equal(result.pages['hamr-routing'], 1);
  fs.unlinkSync(file);
});

test('recordAccess: array of slugs records all', () => {
  const file = tmpFile();
  const result = W.recordAccess('concepts', ['a', 'b', 'c'], { file });
  assert.equal(result.totalAccess, 1);
  assert.equal(result.pages.a, 1);
  assert.equal(result.pages.b, 1);
  assert.equal(result.pages.c, 1);
  fs.unlinkSync(file);
});

test('recordAccess: AC1 — after 5 reads pages map has >=1 entry', () => {
  const file = tmpFile();
  for (let i = 0; i < 5; i++) W.recordAccess('concepts', `page-${i}`, { file });
  const result = W.loadMetrics(file);
  assert.ok(Object.keys(result.pages).length >= 1);
  fs.unlinkSync(file);
});

test('recordAccess: atomic write (tmp+rename) — no orphan tmp on success', () => {
  const file = tmpFile();
  W.recordAccess('concepts', 'page', { file });
  const dir = path.dirname(file);
  const tmps = fs.readdirSync(dir).filter(name => name.startsWith(path.basename(file) + '.tmp'));
  assert.equal(tmps.length, 0, 'no orphan tmp files after successful write');
  fs.unlinkSync(file);
});

test('recordAccess: ignores non-string slug values', () => {
  const file = tmpFile();
  const result = W.recordAccess('concepts', ['valid', null, 123, undefined, 'also-valid'], { file });
  assert.equal(result.pages.valid, 1);
  assert.equal(result.pages['also-valid'], 1);
  assert.equal(Object.keys(result.pages).length, 2);
  fs.unlinkSync(file);
});

test('recordAccess: section-level telemetry preserved (AC3 no regression)', () => {
  const file = tmpFile();
  W.recordAccess('concepts', 'a', { file });
  W.recordAccess('entities', 'b', { file });
  W.recordAccess('concepts', null, { file });
  const result = W.loadMetrics(file);
  assert.equal(result.sections.concepts, 2);
  assert.equal(result.sections.entities, 1);
  fs.unlinkSync(file);
});

test('recordAccess: AC6 wikiType defaults to wisdom for forward-compat (#1942)', () => {
  const file = tmpFile();
  W.recordAccess('concepts', 'page', { file });
  const result = W.loadMetrics(file);
  assert.equal(result.pagesByType.wisdom.page, 1);
  fs.unlinkSync(file);
});

test('recordAccess: AC6 explicit wikiType partitions pagesByType (#1942 Phase-1)', () => {
  const file = tmpFile();
  W.recordAccess('concepts', 'wisdom-page', { file });
  W.recordAccess('files', 'code-page', { file, wikiType: 'code-base' });
  W.recordAccess('tickets', 'ticket-page', { file, wikiType: 'work-log' });
  const result = W.loadMetrics(file);
  assert.equal(result.pagesByType.wisdom['wisdom-page'], 1);
  assert.equal(result.pagesByType['code-base']['code-page'], 1);
  assert.equal(result.pagesByType['work-log']['ticket-page'], 1);
  assert.equal(result.pages['wisdom-page'], 1, 'flat pages map still aggregates all types');
  assert.equal(result.pages['code-page'], 1);
  fs.unlinkSync(file);
});

test('loadMetrics: returns default shape with pagesByType when file missing', () => {
  const result = W.loadMetrics('/nonexistent-path-xyz.json');
  assert.equal(result.totalAccess, 0);
  assert.deepEqual(result.sections, {});
  assert.deepEqual(result.pages, {});
  assert.deepEqual(result.pagesByType, {});
});

test('loadMetrics: handles malformed JSON gracefully', () => {
  const file = tmpFile();
  fs.writeFileSync(file, 'not-json');
  const result = W.loadMetrics(file);
  assert.equal(result.totalAccess, 0);
  fs.unlinkSync(file);
});

test('getTopPages: sorted descending by count (flat namespace)', () => {
  const m = { pages: { a: 1, b: 5, c: 3, d: 2 } };
  const top = W.getTopPages(m, 3);
  assert.deepEqual(top, [
    { slug: 'b', count: 5 }, { slug: 'c', count: 3 }, { slug: 'd', count: 2 },
  ]);
});

test('getTopPages: AC7 filtered by wikiType (#1942 Phase-1 query path)', () => {
  const m = { pages: { a: 1, b: 1, c: 1 },
    pagesByType: { wisdom: { a: 1, b: 1 }, 'code-base': { c: 1 } } };
  const wisdomTop = W.getTopPages(m, 5, 'wisdom');
  const codeTop = W.getTopPages(m, 5, 'code-base');
  assert.equal(wisdomTop.length, 2);
  assert.equal(codeTop.length, 1);
  assert.equal(codeTop[0].slug, 'c');
});

test('getTopPages: empty pages returns empty array', () => {
  assert.deepEqual(W.getTopPages({ pages: {} }), []);
  assert.deepEqual(W.getTopPages({}), []);
  assert.deepEqual(W.getTopPages(null), []);
});

test('getTopPages: default n=5', () => {
  const m = { pages: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`p${i}`, i + 1])) };
  const top = W.getTopPages(m);
  assert.equal(top.length, 5);
});

test('computeGrade: no usage downgrades score', () => {
  const health = { loaded: true, pages: 100, issues: 0, broken: [], orphans: [] };
  const result = W.computeGrade(health, { totalAccess: 0 });
  assert.ok(result.reasons.some(r => r.includes('No usage')));
});

test('getWikiMetrics: combines metrics + grade', () => {
  const file = tmpFile();
  W.recordAccess('concepts', 'page', { file });
  const health = { loaded: true, pages: 100, issues: 0, broken: [], orphans: [] };
  const result = W.getWikiMetrics(health, { file });
  assert.equal(result.totalAccess, 1);
  assert.ok(result.grade);
  assert.ok(typeof result.score === 'number');
  fs.unlinkSync(file);
});

test('DEFAULT_WIKI_TYPE constant exposes Karpathy default', () => {
  assert.equal(W.DEFAULT_WIKI_TYPE, 'wisdom');
});
