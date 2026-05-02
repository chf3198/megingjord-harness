#!/usr/bin/env node
// scripts/docs-compile.js — README compile pipeline (#796)
// Usage: node scripts/docs-compile.js [--check]
const path = require('path');
const fs = require('fs');
const { markdownMagic } = require('markdown-magic');
const { packageScripts } = require('./global/docs-transforms');

const README = path.join(process.cwd(), 'README.md');
const CHECK_MODE = process.argv.includes('--check');

async function main() {
  const before = fs.readFileSync(README, 'utf-8');
  const result = await markdownMagic({
    files: README,
    transforms: { packageScripts: () => packageScripts() },
    silent: true,
  });
  if (CHECK_MODE) {
    const after = fs.readFileSync(README, 'utf-8');
    if (after !== before) {
      fs.writeFileSync(README, before);
      process.stderr.write('❌ README.md is out of sync with package.json. Run `npm run docs:compile` and commit the result.\n');
      process.exit(1);
    }
    process.stdout.write('✅ README.md is in sync with sources.\n');
    return;
  }
  process.stdout.write(`✅ docs:compile updated ${result?.results?.length || 1} file(s).\n`);
}

main().catch((err) => {
  process.stderr.write(`❌ docs:compile failed: ${err.message}\n`);
  process.exit(1);
});
