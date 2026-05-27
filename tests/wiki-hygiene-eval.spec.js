// Wiki hygiene scanner + eval harness tests (#870 + #872).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'hygiene.js'));
const E = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'eval-harness.js'));
const HC = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'health-contract.js'));
const W = require(path.resolve(__dirname, '..', 'scripts', 'wiki', 'wiki-io.js'));

function tmpWikiDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-health-'));
}

test('hygiene tokens lowercases and drops short tokens', () => {
  const t = H.tokens('Hello World HAMR_test xy');
  expect(t.has('hello')).toBe(true);
  expect(t.has('hamr')).toBe(true);
  expect(t.has('xy')).toBe(false);
});

test('hygiene jaccard symmetric on identical sets', () => {
  const s = new Set(['a', 'b', 'c']);
  expect(H.jaccard(s, s)).toBe(1);
});

test('hygiene jaccard zero on disjoint sets', () => {
  expect(H.jaccard(new Set(['a']), new Set(['b']))).toBe(0);
});

test('hygiene constants match documented thresholds', () => {
  expect(H.STALE_DAYS).toBe(180);
  expect(H.DUP_TOKEN_OVERLAP).toBe(0.85);
  expect(H.WEAK_LINK_THRESHOLD).toBe(2);
});

test('hygiene scanAll returns all 4 categories', () => {
  const result = H.scanAll();
  expect(result).toHaveProperty('stale');
  expect(result).toHaveProperty('duplicates');
  expect(result).toHaveProperty('orphans');
  expect(result).toHaveProperty('weak_links');
  expect(Array.isArray(result.stale)).toBe(true);
});

test('hygiene orphans/frontmatter match unified health contract', () => {
  const scan = H.scanAll();
  const health = HC.computeWikiHealth();
  expect(scan.orphans.sort()).toEqual(health.orphans.sort());
  expect(scan.frontmatter.sort()).toEqual(health.frontmatter.sort());
});

test('health contract rejects scan root outside repo wiki by default', () => {
  expect(() => HC.scanHealth(path.resolve(W.WIKI_DIR, '..'))).toThrow(/Refusing external wikiDir/);
});

test('health contract recognizes Wiki B work-log pages with explicit external override', () => {
  const wikiDir = tmpWikiDir();
  fs.mkdirSync(path.join(wikiDir, 'entities'), { recursive: true });
  fs.mkdirSync(path.join(wikiDir, 'work-log', 'tickets'), { recursive: true });
  fs.mkdirSync(path.join(wikiDir, 'work-log', 'prs'), { recursive: true });
  fs.writeFileSync(path.join(wikiDir, 'index.md'), [
    '# Wiki Index',
    '',
    '## Work Log',
    '- [[2054]] — Wiki B mirror',
    '- [[2101]] — Wiki B PR',
    '',
    '## Entities',
    '- [[openclaw]] — OpenClaw',
  ].join('\n'));
  fs.writeFileSync(path.join(wikiDir, 'entities', 'openclaw.md'), '---\ntitle: OpenClaw\ntype: entity\ncreated: 2026-05-27\nstatus: draft\n---\n');
  fs.writeFileSync(path.join(wikiDir, 'work-log', 'tickets', '2054.md'), '---\ntitle: Wiki B mirror\ntype: ticket\ncreated: 2026-05-27\nstatus: draft\n---\n');
  fs.writeFileSync(path.join(wikiDir, 'work-log', 'prs', '2101.md'), '---\ntitle: Wiki B PR\ntype: pr\ncreated: 2026-05-27\nstatus: draft\n---\n');

  const pages = W.listPages(wikiDir, { allowExternalWikiDir: true });
  const health = HC.computeWikiHealth(pages, wikiDir, { allowExternalWikiDir: true });
  expect(health.pages).toBe(3);
  expect(health.indexSync).toEqual([]);
  expect(health.orphans).toEqual([]);
  expect(health.frontmatter).toEqual([]);
});

test('eval precisionAtK returns hits/k', () => {
  expect(E.precisionAtK(['a', 'b', 'c'], ['a', 'b'], 3)).toBeCloseTo(2 / 3, 2);
  expect(E.precisionAtK(['x', 'y'], ['z'], 5)).toBe(0);
});

test('eval recallAtK returns hits/expected-count', () => {
  expect(E.recallAtK(['a', 'b'], ['a', 'b', 'c'], 5)).toBeCloseTo(2 / 3, 2);
});

test('eval QUALITY_FLOOR matches documented threshold', () => {
  expect(E.QUALITY_FLOOR).toBe(0.40);
  expect(E.PRECISION_AT).toBe(5);
});

test('eval loadGroundTruth returns array of queries', () => {
  const queries = E.loadGroundTruth();
  expect(Array.isArray(queries)).toBe(true);
  if (queries.length) {
    expect(queries[0]).toHaveProperty('q');
    expect(queries[0]).toHaveProperty('expected');
  }
});
