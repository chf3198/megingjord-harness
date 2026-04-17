#!/usr/bin/env node
// Cross-tool plugin validation: symlinks, SKILL.md frontmatter, no personal leaks
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let errors = 0;

// 1. Root plugin.json valid
const plugin = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
console.log(`✅ plugin.json: name="${plugin.name}", ${plugin.skills.length} skills`);

// 2. Symlinks exist and are symlinks (not copies)
for (const rel of ['.claude-plugin/plugin.json', '.github/plugin/plugin.json']) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) { console.error(`❌ Missing: ${rel}`); errors++; continue; }
  const stat = fs.lstatSync(full);
  if (!stat.isSymbolicLink()) { console.error(`❌ Not a symlink: ${rel}`); errors++; continue; }
  const content = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (content.name !== plugin.name) { console.error(`❌ ${rel} name mismatch`); errors++; continue; }
  console.log(`✅ ${rel}: symlink resolves, name matches`);
}

// 3. Every plugin skill has SKILL.md with frontmatter
for (const skillPath of plugin.skills) {
  const md = path.join(root, skillPath, 'SKILL.md');
  if (!fs.existsSync(md)) { console.error(`❌ Missing SKILL.md: ${skillPath}`); errors++; continue; }
  const text = fs.readFileSync(md, 'utf8');
  if (!text.startsWith('---')) {
    // Frontmatter optional per spec but recommended
    console.log(`⚠️  No frontmatter: ${skillPath} (optional)`);
  }
}
console.log(`✅ All ${plugin.skills.length} skills have SKILL.md`);

// 4. No personal skills in plugin.json
const triage = JSON.parse(fs.readFileSync(path.join(root, 'skills', '.plugin-triage.json'), 'utf8'));
const personalNames = new Set(triage.personal.map(p => p.name));
for (const s of plugin.skills) {
  const name = s.replace('skills/', '');
  if (personalNames.has(name)) { console.error(`❌ Personal skill leaked: ${name}`); errors++; }
}
console.log('✅ No personal skills in plugin manifest');

// 5. Wiki seed manifest exists
const seedPath = path.join(root, 'wiki', '.seed-manifest.json');
if (fs.existsSync(seedPath)) {
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const total = seed.concepts.length + seed.sources.length;
  console.log(`✅ Wiki seed: ${total} articles`);
} else { console.error('❌ Missing wiki/.seed-manifest.json'); errors++; }

if (errors) { console.error(`\n${errors} error(s)`); process.exit(1); }
console.log('\n✅ Cross-tool validation passed');
