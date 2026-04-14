// Wiki Pages API — return structured page list from wiki/
const fs = require('fs');
const path = require('path');

module.exports = function getWikiPages(wikiDir, cats) {
  const pages = [];
  for (const d of cats) {
    const dp = path.join(wikiDir, d);
    if (!fs.existsSync(dp)) continue;
    for (const f of fs.readdirSync(dp).filter(x => x.endsWith('.md'))) {
      const slug = f.replace('.md', '');
      const raw = fs.readFileSync(path.join(dp, f), 'utf-8');
      const fm = raw.match(/^---\n([\s\S]*?)\n---/);
      let title = slug, tags = [];
      if (fm) {
        const tl = fm[1].match(/title:\s*"?([^"\n]+)"?/);
        const tg = fm[1].match(/tags:\s*\[([^\]]*)\]/);
        if (tl) title = tl[1].trim();
        if (tg) tags = tg[1].split(',').map(t => t.trim());
      }
      pages.push({ slug, type: d, title, tags });
    }
  }
  return pages;
};
