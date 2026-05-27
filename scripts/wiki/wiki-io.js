const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { REPO_WIKI_DIR, assertWikiDir } = require('./path-guard');

const WIKI_DIR = REPO_WIKI_DIR;
const DATE_TOLERANCE_DAYS = 1;
const CATS = ['entities', 'concepts', 'sources', 'syntheses', 'skills'];
const WORK_LOG_DIRS = [{ dir: 'work-log/tickets', type: 'ticket' }, { dir: 'work-log/prs', type: 'pr' }];
const TYPE_DIR = {
  entity: 'entities', entities: 'entities', concept: 'concepts', concepts: 'concepts',
  source: 'sources', sources: 'sources', synthesis: 'syntheses', syntheses: 'syntheses',
  skill: 'skills', skills: 'skills', ticket: 'work-log/tickets', tickets: 'work-log/tickets',
  pr: 'work-log/prs', prs: 'work-log/prs',
};
const SECTION_MAP = {
  entity: '## Entities', entities: '## Entities', concept: '## Concepts', concepts: '## Concepts',
  source: '## Source Summaries', sources: '## Source Summaries', synthesis: '## Syntheses',
  syntheses: '## Syntheses', ticket: '## Work Log', tickets: '## Work Log', pr: '## Work Log', prs: '## Work Log',
};

function parseFrontmatter(content) {
  try {
    const parsed = matter(String(content || ''));
    return { frontmatter: parsed.data || {}, body: parsed.content || '' };
  } catch { return { frontmatter: {}, body: String(content || '') }; }
}

function updateIndex(slug, title, type, wikiDir = WIKI_DIR, options = {}) {
  const root = assertWikiDir(wikiDir, options);
  const indexPath = path.join(root, 'index.md');
  let content = fs.readFileSync(indexPath, 'utf-8');
  const section = SECTION_MAP[type] || '## Source Summaries';
  const entry = `- [[${slug}]] — ${title}`;
  if (content.includes(`[[${slug}]]`)) return;
  const sectionIdx = content.indexOf(section);
  if (sectionIdx === -1) return;
  const nextSection = content.indexOf('\n## ', sectionIdx + 1);
  const insertAt = nextSection !== -1 ? nextSection : content.indexOf('\n---');
  content = insertAt === -1 ? `${content}\n${entry}\n` : `${content.slice(0, insertAt)}\n${entry}\n${content.slice(insertAt)}`;
  const pages = countPages(root, options);
  content = content.replace(/\*\*Pages\*\*:.*$/m, `**Pages**: ${pages} | **Last updated**: ${new Date().toISOString().split('T')[0]}`);
  fs.writeFileSync(indexPath, content);
}

function writePage(slug, type, content, wikiDir = WIKI_DIR, options = {}) {
  const root = assertWikiDir(wikiDir, options);
  const dir = TYPE_DIR[type] || 'sources';
  const pagePath = path.join(root, dir, `${slug}.md`);
  fs.mkdirSync(path.dirname(pagePath), { recursive: true });
  fs.writeFileSync(pagePath, content);
  const { frontmatter } = parseFrontmatter(content);
  updateIndex(slug, frontmatter.title || slug, type, root, options);
  return pagePath;
}

function appendLog(date, operation, subject, wikiDir = WIKI_DIR, options = {}) {
  const root = assertWikiDir(wikiDir, options);
  const maxFutureMs = Date.now() + DATE_TOLERANCE_DAYS * 86400000;
  const parsedDate = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsedDate)) throw new Error(`Invalid wiki log date: ${date}`);
  if (parsedDate > maxFutureMs) throw new Error(`Refusing future wiki log date '${date}' (tolerance ${DATE_TOLERANCE_DAYS} day).`);
  fs.appendFileSync(path.join(root, 'log.md'), `\n## [${date}] ${operation} | ${subject}\n`);
}

function listPages(wikiDir = WIKI_DIR, options = {}) {
  const root = assertWikiDir(wikiDir, options);
  const pages = [];
  for (const d of CATS) {
    const dp = path.join(root, d);
    if (!fs.existsSync(dp)) continue;
    for (const f of fs.readdirSync(dp).filter(x => x.endsWith('.md'))) pages.push({ slug: f.replace('.md', ''), type: d, path: path.join(dp, f) });
  }
  for (const { dir, type } of WORK_LOG_DIRS) {
    const dp = path.join(root, dir);
    if (!fs.existsSync(dp)) continue;
    for (const f of fs.readdirSync(dp).filter(x => x.endsWith('.md'))) pages.push({ slug: f.replace('.md', ''), type, path: path.join(dp, f) });
  }
  return pages;
}

function countPages(wikiDir = WIKI_DIR, options = {}) { return listPages(wikiDir, options).length; }

module.exports = { parseFrontmatter, updateIndex, writePage, appendLog, countPages, listPages, WIKI_DIR, DATE_TOLERANCE_DAYS, CATS, WORK_LOG_DIRS, TYPE_DIR, SECTION_MAP };
