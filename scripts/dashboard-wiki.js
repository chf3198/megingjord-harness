const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const WIKI_DIR = path.join(ROOT, 'wiki');
const WIKI_CATS = ['entities', 'concepts', 'sources', 'syntheses'];

function getWikiHealth() {
  let pages = 0, broken = [], orphans = [];
  const fmIssues = [], idxIssues = [], allSlugs = new Set();
  const inbound = new Set(), linkGraph = {};
  for (const d of WIKI_CATS) {
    const dp = path.join(WIKI_DIR, d);
    if (!fs.existsSync(dp)) continue;
    for (const f of fs.readdirSync(dp).filter(x => x.endsWith('.md'))) {
      const slug = f.replace('.md', ''); allSlugs.add(slug); pages++;
      const content = fs.readFileSync(path.join(dp, f), 'utf-8');
      const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
      linkGraph[slug] = links; links.forEach(l => inbound.add(l));
      if (!content.startsWith('---')) fmIssues.push(slug);
    }
  }
  for (const [slug, links] of Object.entries(linkGraph))
    links.forEach(l => { if (!allSlugs.has(l)) broken.push(`${slug}→${l}`); });
  for (const s of allSlugs) if (!inbound.has(s)) orphans.push(s);
  const idxPath = path.join(WIKI_DIR, 'index.md');
  const idx = fs.existsSync(idxPath) ? fs.readFileSync(idxPath, 'utf-8') : '';
  for (const s of allSlugs) if (!idx.includes(`[[${s}]]`)) idxIssues.push(s);
  return { loaded: true, pages, dirs: WIKI_CATS.length,
    issues: broken.length + orphans.length + fmIssues.length + idxIssues.length,
    broken, orphans, frontmatter: fmIssues, indexSync: idxIssues,
    lastCheck: new Date().toISOString() };
}

function getWikiPages() { return require('./wiki-pages-api')(WIKI_DIR, WIKI_CATS); }
module.exports = { getWikiHealth, getWikiPages };
