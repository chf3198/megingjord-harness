#!/usr/bin/env node
// scripts/wiki/anneal.js — Wiki self-annealing: detect + fix issues
// Dry-run default, --apply to write. Fleet routing: local
const fs = require('fs');
const path = require('path');
const { parseFrontmatter, listPages, WIKI_DIR, appendLog } = require('./wiki-io');

const APPLY = process.argv.includes('--apply');
const fixes = { broken: [], orphans: [], frontmatter: [] };

function fuzzyMatch(target, slugs) {
  const norm = (s) => s.replace(/[-_]/g, '').toLowerCase();
  const t = norm(target);
  for (const s of slugs) {
    if (norm(s).includes(t) || t.includes(norm(s))) return s;
  }
  return null;
}

function fixBrokenLinks(pages, allSlugs) {
  for (const page of pages) {
    let content = fs.readFileSync(page.path, 'utf-8');
    let changed = false;
    for (const [, link] of content.matchAll(/\[\[([^\]]+)\]\]/g)) {
      if (allSlugs.has(link)) continue;
      const match = fuzzyMatch(link, [...allSlugs]);
      if (!match) continue;
      content = content.replace(`[[${link}]]`, `[[${match}]]`);
      fixes.broken.push(`${page.slug}: [[${link}]] → [[${match}]]`);
      changed = true;
    }
    if (changed && APPLY) fs.writeFileSync(page.path, content);
  }
}

function fixOrphans(pages, allSlugs) {
  const inbound = new Set();
  for (const p of pages) {
    const content = fs.readFileSync(p.path, 'utf-8');
    for (const [, l] of content.matchAll(/\[\[([^\]]+)\]\]/g)) inbound.add(l);
  }
  const indexPath = path.join(WIKI_DIR, 'index.md');
  let idx = fs.readFileSync(indexPath, 'utf-8');
  let idxChanged = false;
  for (const slug of allSlugs) {
    if (inbound.has(slug)) continue;
    if (idx.includes(`[[${slug}]]`)) continue;
    const page = pages.find((p) => p.slug === slug);
    if (!page) continue;
    const section = sectionForType(page.type);
    const entry = `- [[${slug}]]`;
    const sIdx = idx.indexOf(section);
    if (sIdx === -1) continue;
    const nextSec = idx.indexOf('\n## ', sIdx + section.length);
    const at = nextSec !== -1 ? nextSec : idx.length;
    idx = idx.slice(0, at) + `\n${entry}` + idx.slice(at);
    fixes.orphans.push(`${slug} → added to index.md under ${section}`);
    idxChanged = true;
  }
  if (idxChanged && APPLY) fs.writeFileSync(indexPath, idx);
}

function sectionForType(type) {
  const map = { entities: '## Entities', concepts: '## Concepts',
    sources: '## Source Summaries', syntheses: '## Syntheses' };
  return map[type] || '## Source Summaries';
}

function fixFrontmatter(pages) {
  for (const page of pages) {
    let content = fs.readFileSync(page.path, 'utf-8');
    if (content.startsWith('---')) continue;
    const title = page.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const typeMap = { entities:'entity', concepts:'concept', sources:'source', syntheses:'synthesis' };
    const fm = `---\ntitle: "${title}"\ntype: ${typeMap[page.type] || 'source'}\n` +
      `created: ${new Date().toISOString().split('T')[0]}\nstatus: active\n---\n`;
    content = fm + content;
    fixes.frontmatter.push(`${page.slug}: prepended frontmatter`);
    if (APPLY) fs.writeFileSync(page.path, content);
  }
}

function run() {
  const pages = listPages();
  const allSlugs = new Set(pages.map((p) => p.slug));
  fixBrokenLinks(pages, allSlugs); fixOrphans(pages, allSlugs); fixFrontmatter(pages);
  const total = Object.values(fixes).reduce((s, a) => s + a.length, 0);
  console.log(`\n🔧 Wiki Anneal ${APPLY ? '(APPLIED)' : '(dry-run)'} — ${total} fixes\n`);
  for (const [cat, items] of Object.entries(fixes)) {
    if (!items.length) continue;
    console.log(`${cat} (${items.length}):`);
    items.forEach((i) => console.log(`  ✓ ${i}`));
    console.log();
  }
  if (!total) console.log('✅ Nothing to fix.\n');
  if (total && APPLY) appendLog(new Date().toISOString().split('T')[0], 'anneal', `${total} fixes applied`);
  if (!APPLY && total) console.log('Run with --apply to write changes.\n');
}
run();
