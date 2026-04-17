#!/usr/bin/env node
// Validates plugin.json skills array matches .plugin-triage.json
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const plugin = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
const triage = JSON.parse(fs.readFileSync(path.join(root, 'skills', '.plugin-triage.json'), 'utf8'));

const pluginSkills = (plugin.skills || []).map(s => s.replace('skills/', ''));
const universalSet = new Set(triage.universal);
const personalNames = triage.personal.map(p => p.name);
const personalSet = new Set(personalNames);
let errors = 0;

// Check: every plugin skill must be marked universal
for (const skill of pluginSkills) {
  if (!universalSet.has(skill)) {
    console.error(`❌ plugin.json references "${skill}" not in triage universal list`);
    errors++;
  }
}
// Check: every universal skill must be in plugin.json
for (const skill of triage.universal) {
  if (!pluginSkills.includes(skill)) {
    console.error(`❌ triage universal "${skill}" missing from plugin.json`);
    errors++;
  }
}
// Check: no personal skill in plugin.json
for (const skill of pluginSkills) {
  if (personalSet.has(skill)) {
    console.error(`❌ personal skill "${skill}" found in plugin.json`);
    errors++;
  }
}
// Check: all skill dirs accounted for
const allDirs = fs.readdirSync(path.join(root, 'skills'))
  .filter(d => !d.startsWith('.') && fs.statSync(path.join(root, 'skills', d)).isDirectory());
const triaged = new Set([...triage.universal, ...personalNames]);
for (const dir of allDirs) {
  if (!triaged.has(dir)) {
    console.error(`❌ skill dir "${dir}" not in triage manifest`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n${errors} triage error(s) found.`);
  process.exit(1);
}
console.log(`✅ Plugin triage valid: ${pluginSkills.length} universal, ${personalNames.length} personal, ${allDirs.length} total dirs`);
