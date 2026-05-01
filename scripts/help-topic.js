// Help topic CLI — search the LLM wiki for a term (#718)
const { execSync } = require('child_process');
const path = require('path');

const term = process.argv[2];
if (!term) {
  process.stderr.write('Usage: npm run help:topic -- <search-term>\n');
  process.exit(1);
}

const wikiScript = path.join(process.env.HOME, '.copilot/scripts/wiki-search.js');

try {
  const output = execSync(`node "${wikiScript}" "${term}"`, { encoding: 'utf8' });
  process.stdout.write(output);
} catch (err) {
  process.stderr.write(`wiki-search failed: ${err.message}\n`);
  process.exit(1);
}
