// scripts/wiki/health-contract.js — unified structural health model for wiki tools.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { listPages, parseFrontmatter, WIKI_DIR } = require('./wiki-io');
const { assertWikiDir } = require('./path-guard');

const REQUIRED_FIELDS = ['title', 'type', 'created', 'status'];
const CATS = ['wisdom/global/entities', 'wisdom/global/concepts', 'wisdom/global/sources', 'wisdom/global/syntheses', 'work-log/tickets', 'work-log/prs'];

function links(content) {
  return [...String(content).matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
}

function computeWikiHealth(pages = null, wikiDir = WIKI_DIR, options = {}) {
  const root = assertWikiDir(wikiDir, options);
  const set = pages || listPages(root, options);
  const allSlugs = new Set(set.map(p => p.slug));
  const broken = []; const orphans = []; const frontmatter = []; const indexSync = [];
  const inbound = new Set();
  for (const page of set) {
    const raw = fs.readFileSync(page.path, 'utf-8');
    const { frontmatter: fm } = parseFrontmatter(raw);
    for (const field of REQUIRED_FIELDS) if (!fm[field]) frontmatter.push(`${page.slug}: missing '${field}'`);
    for (const target of links(raw)) {
      inbound.add(target);
      if (!allSlugs.has(target)) broken.push(`${page.slug}→${target}`);
    }
  }
  const idx = fs.existsSync(path.join(root, 'index.md')) ? fs.readFileSync(path.join(root, 'index.md'), 'utf-8') : '';
  for (const target of links(idx)) inbound.add(target);
  for (const slug of allSlugs) {
    if (!inbound.has(slug)) orphans.push(slug);
    if (!idx.includes(`[[${slug}]]`)) indexSync.push(slug);
  }
  return {
    loaded: true, pages: set.length, dirs: CATS.length,
    issues: broken.length + orphans.length + frontmatter.length + indexSync.length,
    broken, orphans, frontmatter, indexSync,
    lastCheck: new Date().toISOString(),
  };
}

function scanHealth(wikiDir = WIKI_DIR, options = {}) {
  const root = assertWikiDir(wikiDir, options);
  const pages = listPages(root, options);
  const h = computeWikiHealth(pages, root, options);
  const score = h.pages === 0 ? 100 : Math.max(0, 100 - Math.round(h.issues / h.pages * 100));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
  return { ...h, stale: [], weakLinks: [], score, grade };
}

module.exports = { computeWikiHealth, scanHealth, REQUIRED_FIELDS, CATS };
