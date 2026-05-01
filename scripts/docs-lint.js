// Docs drift detector — checks HELP↔script, HELP↔wiki, stale instructions (#722)
const fs = require('fs');
const path = require('path');

const STALE_THRESHOLD_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HELP_DIR = 'dashboard/js';
const INSTRUCTIONS_DIR = 'instructions';
const WIKI_BASE = path.join(process.env.HOME, '.copilot/wiki');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = packageJson.scripts || {};
let failCount = 0;
let warnCount = 0;

const helpFiles = fs.readdirSync(HELP_DIR)
  .filter(name => name.startsWith('help-') && name.endsWith('.js'));

helpFiles.forEach(name => {
  const filePath = path.join(HELP_DIR, name);
  const content = fs.readFileSync(filePath, 'utf8');

  const scriptRegex = /npm run ([\w:-]+)/g;
  let match;
  while ((match = scriptRegex.exec(content)) !== null) {
    if (!scripts[match[1]]) {
      console.log(`❌ Missing script: ${match[1]} in ${name}`);
      failCount += 1;
    }
  }

  const wikiRegex = /\[\[([\w-]+)\]\]/g;
  while ((match = wikiRegex.exec(content)) !== null) {
    const conceptPath = path.join(WIKI_BASE, 'concepts', `${match[1]}.md`);
    const entityPath = path.join(WIKI_BASE, 'entities', `${match[1]}.md`);
    if (!fs.existsSync(conceptPath) && !fs.existsSync(entityPath)) {
      console.log(`❌ Missing wiki: ${match[1]} in ${name}`);
      failCount += 1;
    }
  }
});

const now = Date.now();
const staleThresholdMs = STALE_THRESHOLD_DAYS * MS_PER_DAY;

fs.readdirSync(INSTRUCTIONS_DIR)
  .filter(name => name.endsWith('.md'))
  .forEach(name => {
    const stats = fs.statSync(path.join(INSTRUCTIONS_DIR, name));
    if ((now - stats.mtimeMs) > staleThresholdMs) {
      console.log(`⚠️  Stale (>${STALE_THRESHOLD_DAYS}d): ${name}`);
      warnCount += 1;
    }
  });

console.log(failCount === 0
  ? `✅ docs-lint clean (${warnCount} warnings)`
  : `❌ docs-lint: ${failCount} issues, ${warnCount} warnings`);
process.exit(failCount > 0 ? 1 : 0);
