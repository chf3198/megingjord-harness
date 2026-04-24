// scripts/wiki/wiki-io.js — File I/O helpers for wiki operations

const fs = require('fs');
const path = require('path');

const WIKI_DIR = path.join(__dirname, '../../wiki');

/** Parse YAML-ish frontmatter from markdown. */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const fm = {};
  match[1].split('\n').forEach((line) => {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) fm[key.trim()] = rest.join(':').trim();
  });
  return { frontmatter: fm, body: match[2] };
}

/** Add an entry to wiki/index.md under the appropriate section. */
function updateIndex(slug, title, type) {
  const indexPath = path.join(WIKI_DIR, 'index.md');
  let content = fs.readFileSync(indexPath, 'utf-8');
  const sectionMap = {
    entity: '## Entities',
    concept: '## Concepts',
    source: '## Source Summaries',
    synthesis: '## Syntheses',
  };
  const section = sectionMap[type] || '## Source Summaries';
  const entry = `- [[${slug}]] — ${title}`;

  if (content.includes(`[[${slug}]]`)) return; // already indexed

  const sectionIdx = content.indexOf(section);
  if (sectionIdx === -1) return;
  const nextSection = content.indexOf('\n## ', sectionIdx + 1);
  const insertAt = nextSection !== -1 ? nextSection : content.indexOf('\n---');
  if (insertAt === -1) {
    content += `\n${entry}\n`;
  } else {
    content = content.slice(0, insertAt) + `\n${entry}\n` + content.slice(insertAt);
  }

  // Update stats line
  const pages = countPages();
  content = content.replace(
    /\*\*Pages\*\*:.*$/m,
    `**Pages**: ${pages} | **Last updated**: ${new Date().toISOString().split('T')[0]}`
  );
  fs.writeFileSync(indexPath, content);
}

/** Append a log entry to wiki/log.md. */
function appendLog(date, operation, subject) {
  const logPath = path.join(WIKI_DIR, 'log.md');
  const entry = `\n## [${date}] ${operation} | ${subject}\n`;
  fs.appendFileSync(logPath, entry);
}

/** Count all .md files in wiki subdirs (not index/log). */
function countPages() {
  const dirs = ['entities', 'concepts', 'sources', 'syntheses'];
  let count = 0;
  for (const d of dirs) {
    const dp = path.join(WIKI_DIR, d);
    if (!fs.existsSync(dp)) continue;
    count += fs.readdirSync(dp).filter((f) => f.endsWith('.md')).length;
  }
  return count;
}

/** List all wiki page slugs with their paths. */
function listPages() {
  const dirs = ['entities', 'concepts', 'sources', 'syntheses'];
  const pages = [];
  for (const d of dirs) {
    const dp = path.join(WIKI_DIR, d);
    if (!fs.existsSync(dp)) continue;
    for (const f of fs.readdirSync(dp).filter((x) => x.endsWith('.md'))) {
      pages.push({ slug: f.replace('.md', ''), type: d, path: path.join(dp, f) });
    }
  }
  return pages;
}

module.exports = {
  parseFrontmatter, updateIndex, appendLog,
  countPages, listPages, WIKI_DIR,
};
