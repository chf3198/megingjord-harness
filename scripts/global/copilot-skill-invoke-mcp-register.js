#!/usr/bin/env node
// copilot-skill-invoke-mcp-register.js — register megingjord-skill-invoke MCP
// server in Copilot / Claude user config. Mirrors xteam-mcp-register.js pattern.
// Refs #3047.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const NAME = 'megingjord-skill-invoke';
const VALID = ['copilot', 'claude', 'all'];

function usage() {
  console.error('Usage: copilot-skill-invoke-mcp-register.js --target <copilot|claude|all> [--root <path>] [--apply]');
  process.exit(1);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').trim() || '{}'); } catch { return {}; }
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

function mergeJson(file, key, value, apply) {
  const obj = readJson(file);
  obj[key] = obj[key] || {};
  const before = JSON.stringify(obj[key][NAME] || null);
  obj[key][NAME] = value;
  const changed = before !== JSON.stringify(obj[key][NAME]);
  if (apply && changed) atomicWrite(file, `${JSON.stringify(obj, null, 2)}\n`);
  return changed;
}

function entry(bin, withType) {
  const base = { command: 'node', args: [bin] };
  return withType ? { type: 'stdio', ...base } : base;
}

const argv = process.argv.slice(2);
let target = 'all';
let root = process.cwd();
let apply = false;

for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--target') target = argv[++i] || '';
  else if (argv[i] === '--root') root = argv[++i] || '';
  else if (argv[i] === '--apply') apply = true;
  else usage();
}
if (!VALID.includes(target)) usage();

const home = process.env.MCP_REGISTER_TEST_HOME || os.homedir();
const bin = path.resolve(root, 'scripts/global/copilot-skill-invoke-mcp.js');

if (!fs.existsSync(bin)) {
  console.error(`Missing MCP entrypoint: ${bin}`);
  process.exit(1);
}

const jobs = {
  copilot: () => mergeJson(
    path.join(home, '.config/Code/User/mcp.json'), 'servers', entry(bin, false), apply,
  ),
  claude: () => mergeJson(
    path.join(home, '.claude.json'), 'mcpServers', entry(bin, true), apply,
  ),
};

const order = target === 'all' ? ['copilot', 'claude'] : [target];
let failed = false;

for (const tgt of order) {
  try {
    const changed = jobs[tgt]();
    const verb = apply ? (changed ? 'updated' : 'no-op') : (changed ? 'would update' : 'would no-op');
    console.log(`${tgt}: ${verb}`);
  } catch (err) {
    failed = true;
    console.error(`${tgt}: failed: ${(err && err.message) || String(err)}`);
  }
}

if (failed) process.exit(1);
