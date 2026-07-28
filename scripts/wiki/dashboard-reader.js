#!/usr/bin/env node
'use strict';
// #3764 (Epic #3719): human browse/search + curation surface for the dashboard wiki reader.
// Enhances the existing reader (wisdom-global-only, no search/curation) into a browsable +
// searchable view across A=code, B=work-log, C=wisdom over BOTH scopes (global + workspace),
// backed by the shipped lexical retrieval floor, plus a curation path that writes through the
// VALIDATED write path (wiki-io#writePage: #3772 secret redaction + #3763 frontmatter) — no
// schema bypass. Cross-refs #2508 (marketplace extension), which this does NOT supersede/close.
const path = require('path');
const fs = require('fs');
const { hybridSearch } = require('./retrieval');
const { writePage, WIKI_DIR } = require('./wiki-io');

// Each wiki directory carries a (type A|B|C, scope global|workspace) tag — the browse/search axes.
const DIR_MAP = [
  { dir: 'code/symbols', type: 'A', scope: 'workspace' },
  { dir: 'code/concepts', type: 'A', scope: 'workspace' },
  { dir: 'work-log/tickets', type: 'B', scope: 'workspace' },
  { dir: 'work-log/prs', type: 'B', scope: 'workspace' },
  { dir: 'wisdom/global/entities', type: 'C', scope: 'global' },
  { dir: 'wisdom/global/concepts', type: 'C', scope: 'global' },
  { dir: 'wisdom/global/sources', type: 'C', scope: 'global' },
  { dir: 'wisdom/global/syntheses', type: 'C', scope: 'global' },
  { dir: 'wisdom/global/skills', type: 'C', scope: 'global' },
  { dir: 'wisdom/project', type: 'C', scope: 'workspace' },
];
const TYPE_ALIAS = { code: 'A', 'work-log': 'B', wisdom: 'C', A: 'A', B: 'B', C: 'C' };

function titleOf(pagePath, slug) {
  try {
    const fm = fs.readFileSync(pagePath, 'utf-8').match(/^---\n([\s\S]*?)\n---/);
    const title = fm && fm[1].match(/title:\s*"?([^"\n]+)"?/);
    return title ? title[1].trim() : slug;
  } catch { return slug; }
}

function selectedDirs(scope, wikiType) {
  const type = wikiType && wikiType !== 'all' ? TYPE_ALIAS[wikiType] : null;
  return DIR_MAP.filter((entry) => (!scope || scope === 'all' || entry.scope === scope)
    && (!type || entry.type === type));
}

/**
 * Browse wiki pages across A/B/C and the global/workspace scopes.
 * @param {{scope?:string, wikiType?:string, wikiDir?:string}} [opts]
 * @returns {Array<{slug:string, type:string, scope:string, title:string, path:string}>}
 */
function browseWiki(opts = {}) {
  const root = opts.wikiDir || WIKI_DIR;
  const pages = [];
  for (const entry of selectedDirs(opts.scope, opts.wikiType)) {
    const dirPath = path.join(root, entry.dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const file of fs.readdirSync(dirPath).filter((f) => f.endsWith('.md'))) {
      const slug = file.replace(/\.md$/, '');
      const pagePath = path.join(dirPath, file);
      pages.push({ slug, type: entry.type, scope: entry.scope, title: titleOf(pagePath, slug), path: pagePath });
    }
  }
  return pages;
}

/**
 * Search the wiki via the shipped lexical retrieval floor, filtered to scope/type.
 * @param {string} query
 * @param {{scope?:string, wikiType?:string, wikiDir?:string, topN?:number}} [opts]
 * @returns {Array<{slug:string, type:string, scope:string, title:string, rank:number}>}
 */
function searchWiki(query, opts = {}) {
  const candidates = browseWiki(opts);
  const bySlug = new Map(candidates.map((page) => [page.slug, page]));
  const ranked = hybridSearch(String(query || ''), candidates)
    .map((result) => (typeof result === 'string' ? result : result.slug));
  const hits = [];
  for (const slug of ranked) {
    const page = bySlug.get(slug);
    if (page) hits.push({ slug: page.slug, type: page.type, scope: page.scope, title: page.title, rank: hits.length + 1 });
    if (hits.length >= (opts.topN || 10)) break;
  }
  return hits;
}

// Inject a frontmatter key/value into a page's frontmatter block (creating one if absent).
function withFrontmatterFlag(content, key, value) {
  const text = String(content || '');
  if (/^---\n[\s\S]*?\n---/.test(text)) {
    return text.replace(/^(---\n[\s\S]*?)\n---/, (m, fm) => `${fm}\n${key}: ${value}\n---`);
  }
  return `---\n${key}: ${value}\n---\n\n${text}`;
}

/**
 * Curate a wiki page through the VALIDATED write path (wiki-io#writePage: redaction + frontmatter).
 * @param {{slug:string, type:string, action?:string, content?:string, wikiDir?:string, options?:object}} req
 * @returns {{ok:boolean, path:string, action:string, via:string}}
 */
function curatePage(req) {
  const { slug, type, wikiDir, options } = req;
  const action = req.action || 'edit';
  const root = wikiDir || WIKI_DIR;
  let content = req.content;
  if (action === 'flag-stale') {
    const existing = browseWiki({ wikiDir: root }).find((page) => page.slug === slug);
    const base = existing ? fs.readFileSync(existing.path, 'utf-8') : String(req.content || '');
    content = withFrontmatterFlag(base, 'status', 'stale');
  }
  // The ONLY write path: wiki-io#writePage applies secret redaction (#3772) + frontmatter/index (#3763).
  const written = writePage(slug, type, content, root, options || {});
  return { ok: true, path: written, action, via: 'wiki-io.writePage' };
}

module.exports = { browseWiki, searchWiki, curatePage, selectedDirs, withFrontmatterFlag, DIR_MAP };

if (require.main === module) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'search') process.stdout.write(JSON.stringify(searchWiki(arg, {}), null, 2) + '\n');
  else process.stdout.write(JSON.stringify(browseWiki({ scope: arg || 'all' }).slice(0, 20), null, 2) + '\n');
  process.exit(0);
}
