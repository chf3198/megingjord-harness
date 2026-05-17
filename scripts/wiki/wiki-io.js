const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const WIKI_DIR = path.join(__dirname, '../../wiki');
const DATE_TOLERANCE_DAYS = 1;
const CATS = ['entities', 'concepts', 'sources', 'syntheses', 'skills'];
const TYPE_DIR = {
  entity: 'entities', entities: 'entities',
  concept: 'concepts', concepts: 'concepts',
  source: 'sources', sources: 'sources',
  synthesis: 'syntheses', syntheses: 'syntheses',
  skill: 'skills', skills: 'skills',
};
const SECTION_MAP = {
  entity: '## Entities', entities: '## Entities',
  concept: '## Concepts', concepts: '## Concepts',
  source: '## Source Summaries', sources: '## Source Summaries',
  synthesis: '## Syntheses', syntheses: '## Syntheses',
};

function parseFrontmatter(content) {
  try {
    const parsed = matter(String(content || ''));
    return { frontmatter: parsed.data || {}, body: parsed.content || '' };
  } catch {
    return { frontmatter: {}, body: String(content || '') };
  }
}

function updateIndex(slug, title, type) {
  const indexPath = path.join(WIKI_DIR, 'index.md');
  let content = fs.readFileSync(indexPath, 'utf-8');
  const section = SECTION_MAP[type] || '## Source Summaries';
  const entry = `- [[${slug}]] — ${title}`;
  if (content.includes(`[[${slug}]]`)) return;
  const sectionIdx = content.indexOf(section);
  if (sectionIdx === -1) return;
  const nextSection = content.indexOf('\n## ', sectionIdx + 1);
  const insertAt = nextSection !== -1 ? nextSection : content.indexOf('\n---');
  content = insertAt === -1
    ? `${content}\n${entry}\n`
    : `${content.slice(0, insertAt)}\n${entry}\n${content.slice(insertAt)}`;
  const pages = countPages();
  content = content.replace(
    /\*\*Pages\*\*:.*$/m,
    `**Pages**: ${pages} | **Last updated**: ${new Date().toISOString().split('T')[0]}`
  );
  fs.writeFileSync(indexPath, content);
}

function writePage(slug, type, content) {
  const dir = TYPE_DIR[type] || 'sources';
  const pagePath = path.join(WIKI_DIR, dir, `${slug}.md`);
  fs.mkdirSync(path.dirname(pagePath), { recursive: true });
  fs.writeFileSync(pagePath, content);
  const { frontmatter } = parseFrontmatter(content);
  updateIndex(slug, frontmatter.title || slug, type);
  return pagePath;
}

function appendLog(date, operation, subject) {
  const now = Date.now();
  const maxFutureMs = now + DATE_TOLERANCE_DAYS * 86400000;
  const parsedDate = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsedDate)) throw new Error(`Invalid wiki log date: ${date}`);
  if (parsedDate > maxFutureMs) throw new Error(`Refusing future wiki log date '${date}' (tolerance ${DATE_TOLERANCE_DAYS} day).`);
  const logPath = path.join(WIKI_DIR, 'log.md');
  fs.appendFileSync(logPath, `\n## [${date}] ${operation} | ${subject}\n`);
}
function countPages() {
  let count = 0;
  for (const d of CATS) {
    const dp = path.join(WIKI_DIR, d);
    if (!fs.existsSync(dp)) continue;
    count += fs.readdirSync(dp).filter((f) => f.endsWith('.md')).length;
  }
  return count;
}
function listPages() {
  const pages = [];
  for (const d of CATS) {
    const dp = path.join(WIKI_DIR, d);
    if (!fs.existsSync(dp)) continue;
    for (const f of fs.readdirSync(dp).filter((x) => x.endsWith('.md')))
      pages.push({ slug: f.replace('.md', ''), type: d, path: path.join(dp, f) });
  }
  return pages;
}

module.exports = {
  parseFrontmatter, updateIndex, writePage, appendLog,
  countPages, listPages, WIKI_DIR, DATE_TOLERANCE_DAYS,
};
