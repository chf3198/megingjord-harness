// tests/wiki-migration.spec.js — AC1-AC8 verification for #2098 legacy path migration
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const WIKI = path.join(REPO, 'wiki');
const WISDOM_GLOBAL = path.join(WIKI, 'wisdom', 'global');

const MIGRATED_DIRS = ['entities', 'concepts', 'sources', 'syntheses', 'skills'];
const LEGACY_DIRS = MIGRATED_DIRS.map(d => path.join(WIKI, d));
const NEW_DIRS = MIGRATED_DIRS.map(d => path.join(WISDOM_GLOBAL, d));

// AC1: All 5 legacy directories have been moved to wiki/wisdom/global/
test('AC1: legacy wiki directories no longer exist at root', () => {
  for (const d of LEGACY_DIRS) {
    expect(fs.existsSync(d), `Legacy path still exists: ${d}`).toBe(false);
  }
});

test('AC1: all 5 directories exist under wiki/wisdom/global/', () => {
  for (const d of NEW_DIRS) {
    expect(fs.existsSync(d), `New path missing: ${d}`).toBe(true);
    expect(fs.statSync(d).isDirectory(), `Not a directory: ${d}`).toBe(true);
  }
});

test('AC1: migrated directories contain .md files', () => {
  for (const d of NEW_DIRS) {
    const files = fs.readdirSync(d).filter(f => f.endsWith('.md'));
    expect(files.length, `${d} has no .md files`).toBeGreaterThan(0);
  }
});

// AC6: wiki/index.md updated — legacy-paths subsection removed
test('AC6: wiki/index.md has no "Legacy paths (still in use)" subsection', () => {
  const idx = fs.readFileSync(path.join(WIKI, 'index.md'), 'utf8');
  expect(idx).not.toContain('### Legacy paths (still in use)');
});

test('AC6: wiki/index.md Storage Layout references wisdom/global/', () => {
  const idx = fs.readFileSync(path.join(WIKI, 'index.md'), 'utf8');
  expect(idx).toContain('wiki/wisdom/global/');
  expect(idx).not.toContain('Currently EMPTY');
});

// AC7: instructions/wiki-knowledge.instructions.md updated
test('AC7: wiki-knowledge instructions has no legacy-paths subsection', () => {
  const p = path.join(REPO, 'instructions', 'wiki-knowledge.instructions.md');
  const c = fs.readFileSync(p, 'utf8');
  expect(c).not.toContain('### Legacy paths (still in use');
  expect(c).not.toContain('Physical migration of legacy paths is queued');
});

test('AC7: wiki-knowledge instructions references wisdom/global/', () => {
  const p = path.join(REPO, 'instructions', 'wiki-knowledge.instructions.md');
  const c = fs.readFileSync(p, 'utf8');
  expect(c).toContain('wiki/wisdom/global/');
});

// AC8: wiki-io.js routes writes and reads through wisdom/global/
test('AC8: wiki-io.js CATS uses wisdom/global paths', () => {
  const p = path.join(REPO, 'scripts', 'wiki', 'wiki-io.js');
  const c = fs.readFileSync(p, 'utf8');
  expect(c).toContain("'wisdom/global/entities'");
  expect(c).toContain("'wisdom/global/concepts'");
  expect(c).toContain("'wisdom/global/sources'");
  expect(c).toContain("'wisdom/global/syntheses'");
  expect(c).toContain("'wisdom/global/skills'");
  // must not contain old bare paths in CATS
  expect(c).not.toMatch(/CATS\s*=\s*\[[\s\S]*?'entities'/);
});

test('AC8: wiki-io.js TYPE_DIR routes to wisdom/global paths', () => {
  const p = path.join(REPO, 'scripts', 'wiki', 'wiki-io.js');
  const c = fs.readFileSync(p, 'utf8');
  expect(c).toContain("entity: 'wisdom/global/entities'");
  expect(c).toContain("source: 'wisdom/global/sources'");
});

// AC8: listPages functional test — finds pages in new locations
test('AC8: listPages() returns pages from wisdom/global/ paths', () => {
  const { listPages } = require('../scripts/wiki/wiki-io');
  const pages = listPages();
  expect(pages.length).toBeGreaterThan(0);
  // All pages should come from wisdom/global/* or work-log/*
  const legacyPages = pages.filter(p =>
    p.path.includes('/wiki/entities/') ||
    p.path.includes('/wiki/concepts/') ||
    p.path.includes('/wiki/sources/') ||
    p.path.includes('/wiki/syntheses/') ||
    p.path.includes('/wiki/skills/')
  );
  expect(legacyPages.length,
    `${legacyPages.length} pages still resolved from legacy paths`
  ).toBe(0);
});

// Golden file: key concept pages resolve in retrieval
test('AC4 golden: hybridSearch finds known concept pages at new paths', () => {
  const { hybridSearch } = require('../scripts/wiki/retrieval');
  const queries = [
    'baton protocol handoff',
    'cascade dispatch fleet routing',
    'hamr cache adapters',
    'self-annealing governance',
    'distributed anneal three tier',
  ];
  for (const q of queries) {
    const results = hybridSearch(q);
    expect(results.length, `No results for query: "${q}"`).toBeGreaterThan(0);
    // All result paths must be under wisdom/global or work-log
    for (const r of results) {
      const legacyMatch = MIGRATED_DIRS.some(d =>
        r.path.includes(`/wiki/${d}/`)
      );
      expect(legacyMatch,
        `Result from legacy path for query "${q}": ${r.path}`
      ).toBe(false);
    }
  }
});
