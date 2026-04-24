#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const MODE = process.argv[2];
const APPLY = process.argv.includes('--apply');
const DRY = process.argv.includes('--dry-run') || (MODE === 'deploy' && !APPLY);
const START = '# >>> devenv-ops managed block >>>';
const END = '# <<< devenv-ops managed block <<<';
const BLOCK = new RegExp(`${START}[\\s\\S]*?${END}\\n?`, 'm');

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function read(file) { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } }
function dirs(src) { return fs.existsSync(src) ? fs.readdirSync(src, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name) : []; }
function wrap(text) { return `${START}\n${text.trim()}\n${END}\n`; }
function logAction(write, action, name) {
  console.log(write ? `  ✅ ${name}` : `  Would ${action}: ${name}`);
}

function syncSkills(src, dest, write, action) {
  console.log('── Codex Skills ──');
  let count = 0;
  for (const name of dirs(src)) {
    if (write) { ensure(dest); fs.cpSync(path.join(src, name), path.join(dest, name), { recursive: true, force: true }); }
    logAction(write, action, name);
    count++;
  }
  console.log(`  Total: ${count}\n`);
}

function mergeManaged(src, dest, write) {
  console.log(`── ${path.basename(dest)} ──`);
  const current = read(dest);
  const managed = wrap(read(src));
  const merged = BLOCK.test(current) ? current.replace(BLOCK, managed) :
    `${current.trim()}${current.trim() ? '\n\n' : ''}${managed}`;
  if (write) { ensure(path.dirname(dest)); fs.writeFileSync(dest, merged); }
  logAction(write, 'merge', path.basename(dest));
  console.log('');
}

function extractManaged(src, dest, write) {
  console.log(`── ${path.basename(src)} ──`);
  const match = read(src).match(new RegExp(`${START}\\n([\\s\\S]*?)\\n${END}`));
  if (!match) return console.log('  Missing managed block\n');
  if (write) { ensure(path.dirname(dest)); fs.writeFileSync(dest, `${match[1].trim()}\n`); }
  logAction(write, 'extract', path.basename(dest));
  console.log('');
}

if (!['deploy', 'sync'].includes(MODE)) {
  console.error('Usage: codex-runtime.js <deploy|sync> [--apply|--dry-run]'); process.exit(1);
}

console.log(`${MODE === 'deploy' ? 'Source' : 'Syncing from'}: ${MODE === 'deploy' ? ROOT : HOME}`);
console.log(`${MODE === 'deploy' ? 'Target' : 'Into'}: ${MODE === 'deploy' ? HOME : ROOT}\n`);
if (MODE === 'deploy') {
  if (DRY) console.log('=== DRY RUN (pass --apply to write Codex runtime) ===\n');
  syncSkills(path.join(ROOT, 'skills'), path.join(HOME, 'skills'), !DRY, 'deploy');
  mergeManaged(path.join(ROOT, '.codex', 'AGENTS.md'), path.join(HOME, 'AGENTS.md'), !DRY);
  mergeManaged(path.join(ROOT, '.codex', 'config.toml'), path.join(HOME, 'config.toml'), !DRY);
} else {
  if (DRY) console.log('=== DRY RUN — no Codex changes will be made ===\n');
  syncSkills(path.join(HOME, 'skills'), path.join(ROOT, 'skills'), !DRY, 'sync');
  extractManaged(path.join(HOME, 'AGENTS.md'), path.join(ROOT, '.codex', 'AGENTS.md'), !DRY);
  extractManaged(path.join(HOME, 'config.toml'), path.join(ROOT, '.codex', 'config.toml'), !DRY);
}
