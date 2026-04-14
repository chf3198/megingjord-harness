#!/usr/bin/env node
// scripts/wiki/lint.js — Wiki structural health checker
// Fleet routing: local (no LLM needed — pure structural checks)
// Usage: node scripts/wiki/lint.js

const fs = require('fs');
const path = require('path');
const { parseFrontmatter, listPages, WIKI_DIR } = require('./wiki-io');

const REQUIRED_FIELDS = ['title', 'type', 'created', 'status'];
const issues = { broken: [], orphans: [], frontmatter: [], index: [] };

function lint() {
  const pages = listPages();
  if (pages.length === 0) {
    console.log('📋 Wiki is empty — nothing to lint.');
    process.exit(0);
  }

  // Collect all wikilinks and build link graph
  const linkGraph = {};  // slug → Set of outbound slugs
  const allSlugs = new Set(pages.map((p) => p.slug));

  for (const page of pages) {
    const content = fs.readFileSync(page.path, 'utf-8');
    const { frontmatter } = parseFrontmatter(content);

    // Check required frontmatter
    for (const field of REQUIRED_FIELDS) {
      if (!frontmatter[field]) {
        issues.frontmatter.push(`${page.slug}: missing '${field}'`);
      }
    }

    // Extract [[wikilinks]]
    const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
    linkGraph[page.slug] = new Set(links);

    // Check for broken links
    for (const link of links) {
      if (!allSlugs.has(link)) {
        issues.broken.push(`${page.slug} → [[${link}]] (not found)`);
      }
    }
  }

  // Check for orphan pages (no inbound links)
  const inbound = new Set();
  for (const [, targets] of Object.entries(linkGraph)) {
    for (const t of targets) inbound.add(t);
  }
  for (const slug of allSlugs) {
    if (!inbound.has(slug)) issues.orphans.push(slug);
  }

  // Check index.md sync
  const indexContent = fs.readFileSync(path.join(WIKI_DIR, 'index.md'), 'utf-8');
  for (const page of pages) {
    if (!indexContent.includes(`[[${page.slug}]]`)) {
      issues.index.push(`${page.slug} missing from index.md`);
    }
  }

  printReport(pages.length);
}

function printReport(pageCount) {
  const total = Object.values(issues).reduce((s, a) => s + a.length, 0);
  console.log(`\n📋 Wiki Lint Report — ${pageCount} pages scanned\n`);

  if (total === 0) {
    console.log('✅ All checks pass. Wiki is healthy.\n');
    process.exit(0);
  }

  const sections = [
    ['🔗 Broken Wikilinks', issues.broken],
    ['🏝️  Orphan Pages', issues.orphans],
    ['📝 Missing Frontmatter', issues.frontmatter],
    ['📇 Index Sync', issues.index],
  ];
  for (const [label, items] of sections) {
    if (items.length === 0) continue;
    console.log(`${label} (${items.length}):`);
    items.forEach((i) => console.log(`  - ${i}`));
    console.log();
  }

  console.log(`Total issues: ${total}`);
  process.exit(1);
}

lint();
