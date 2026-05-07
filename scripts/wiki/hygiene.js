// scripts/wiki/hygiene.js — Wiki hygiene scanners (#870).
// Detects: stale, duplicate, orphan, weak-link pages. Local-only computation.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { listPages, parseFrontmatter, WIKI_DIR } = require('./wiki-io');

const STALE_DAYS = 180;
const DUP_TOKEN_OVERLAP = 0.85;
const WEAK_LINK_THRESHOLD = 2;
const MIN_TOKEN_COUNT = 50;
const MS_PER_DAY = 86400000;

function tokens(text) {
  return new Set(String(text || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []);
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter(t => b.has(t)).length;
  return inter / (a.size + b.size - inter || 1);
}

function findStale(pages, nowMs = Date.now()) {
  const stale = [];
  const cutoff = nowMs - STALE_DAYS * MS_PER_DAY;
  for (const page of pages) {
    const raw = fs.readFileSync(page.path, 'utf-8');
    const { frontmatter } = parseFrontmatter(raw);
    const dateStr = frontmatter.date || frontmatter.updated;
    if (!dateStr) { stale.push({ slug: page.slug, reason: 'no-date' }); continue; }
    const ts = Date.parse(dateStr);
    if (Number.isFinite(ts) && ts < cutoff) {
      stale.push({ slug: page.slug, reason: 'old', age_days: Math.floor((nowMs - ts) / MS_PER_DAY) });
    }
  }
  return stale;
}

function findDuplicates(pages) {
  const docs = pages.map(p => ({ slug: p.slug, tokens: tokens(fs.readFileSync(p.path, 'utf-8')) }))
    .filter(d => d.tokens.size >= MIN_TOKEN_COUNT);
  const dups = [];
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const score = jaccard(docs[i].tokens, docs[j].tokens);
      if (score >= DUP_TOKEN_OVERLAP) {
        dups.push({ a: docs[i].slug, b: docs[j].slug, jaccard: +score.toFixed(3) });
      }
    }
  }
  return dups;
}

function findOrphansAndWeakLinks(pages) {
  const inbound = {};
  const outbound = {};
  for (const page of pages) {
    const content = fs.readFileSync(page.path, 'utf-8');
    const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
    outbound[page.slug] = new Set(links);
    for (const link of links) {
      inbound[link] = (inbound[link] || 0) + 1;
    }
  }
  const orphans = pages.filter(p => !inbound[p.slug] && p.type !== 'sources').map(p => p.slug);
  const weak = pages.filter(p => (outbound[p.slug] || new Set()).size < WEAK_LINK_THRESHOLD).map(p => p.slug);
  return { orphans, weak };
}

function scanAll(pages = null) {
  pages = pages || listPages();
  const stale = findStale(pages);
  const duplicates = findDuplicates(pages);
  const { orphans, weak } = findOrphansAndWeakLinks(pages);
  return { total_pages: pages.length, stale, duplicates, orphans, weak_links: weak,
    thresholds: { STALE_DAYS, DUP_TOKEN_OVERLAP, WEAK_LINK_THRESHOLD } };
}

if (require.main === module) {
  console.log(JSON.stringify(scanAll(), null, 2));
}

module.exports = { scanAll, findStale, findDuplicates, findOrphansAndWeakLinks, jaccard, tokens,
  STALE_DAYS, DUP_TOKEN_OVERLAP, WEAK_LINK_THRESHOLD };
