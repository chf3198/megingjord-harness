// Refs #2153 — unit tests for doc-graph-builder
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildGraph, extractWikilinks, walkMd } = require('../scripts/global/doc-graph-builder.js');

function mkSandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'doc-graph-'));
}

test('extractWikilinks: parses simple [[link]]', () => {
  const links = extractWikilinks('see [[foo-bar]] and [[baz]].');
  assert.deepEqual(links, ['foo-bar', 'baz']);
});

test('extractWikilinks: skips escaped \\[[notlink]]', () => {
  const links = extractWikilinks('escaped \\[[notlink]] and [[real]]');
  assert.deepEqual(links, ['real']);
});

test('extractWikilinks: strips display-text after pipe', () => {
  const links = extractWikilinks('[[target|display text]]');
  assert.deepEqual(links, ['target']);
});

test('extractWikilinks: ignores nested or malformed brackets', () => {
  const links = extractWikilinks('[[[wrong]]] and [[ok]]');
  assert.ok(links.includes('ok'));
});

test('extractWikilinks: no-link returns empty', () => {
  assert.deepEqual(extractWikilinks('plain markdown no links here'), []);
});

test('buildGraph: deterministic across runs (byte-identical)', () => {
  const sb = mkSandbox();
  fs.mkdirSync(path.join(sb, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(sb, 'docs', 'a.md'), 'See [[b-page]] and [[c-page]]');
  fs.writeFileSync(path.join(sb, 'docs', 'b.md'), '[[a-page]]');
  fs.writeFileSync(path.join(sb, 'README.md'), '# Root [[a-page]]');

  const g1 = buildGraph(sb);
  const g2 = buildGraph(sb);
  assert.equal(JSON.stringify(g1), JSON.stringify(g2));
  fs.rmSync(sb, { recursive: true, force: true });
});

test('buildGraph: produces edges with from/to/kind shape', () => {
  const sb = mkSandbox();
  fs.mkdirSync(path.join(sb, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(sb, 'docs', 'a.md'), '[[target-name]]');
  const g = buildGraph(sb);
  const edge = g.edges.find((e) => e.to === 'wikilink:target-name');
  assert.ok(edge);
  assert.equal(edge.from, 'file:docs/a.md');
  assert.equal(edge.kind, 'wikilink');
  fs.rmSync(sb, { recursive: true, force: true });
});

test('buildGraph: skips node_modules and dotfiles', () => {
  const sb = mkSandbox();
  fs.mkdirSync(path.join(sb, 'docs', 'node_modules'), { recursive: true });
  fs.mkdirSync(path.join(sb, 'docs', '.cache'), { recursive: true });
  fs.writeFileSync(path.join(sb, 'docs', 'node_modules', 'skip.md'), '[[should-not-appear]]');
  fs.writeFileSync(path.join(sb, 'docs', '.cache', 'skip.md'), '[[should-not-appear]]');
  fs.writeFileSync(path.join(sb, 'docs', 'real.md'), '[[ok]]');
  const g = buildGraph(sb);
  assert.equal(
    g.edges.find((e) => e.to === 'wikilink:should-not-appear'),
    undefined,
  );
  assert.ok(g.edges.find((e) => e.to === 'wikilink:ok'));
  fs.rmSync(sb, { recursive: true, force: true });
});

test('buildGraph: runs under 5 seconds on sandbox of 50 small files', () => {
  const sb = mkSandbox();
  fs.mkdirSync(path.join(sb, 'docs'), { recursive: true });
  for (let i = 0; i < 50; i++) {
    fs.writeFileSync(path.join(sb, 'docs', `f${i}.md`), `[[link-${i}]] [[shared-target]]`);
  }
  const start = Date.now();
  const g = buildGraph(sb);
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 5000, `expected <5s, got ${elapsed}ms`);
  assert.equal(g.nodes.filter((n) => n.type === 'doc').length, 50);
  fs.rmSync(sb, { recursive: true, force: true });
});

test('walkMd: returns relative paths', () => {
  const sb = mkSandbox();
  fs.mkdirSync(path.join(sb, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(sb, 'sub', 'x.md'), 'content');
  const files = walkMd(path.join(sb, 'sub'), sb);
  assert.deepEqual(files, ['sub/x.md']);
  fs.rmSync(sb, { recursive: true, force: true });
});
