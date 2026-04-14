#!/usr/bin/env node
// emit-event.js — Append a structured event to .dashboard/events.jsonl
// Global utility: deploy to ~/.copilot/scripts/ via npm run deploy:apply
// Usage: node emit-event.js --type ticket:status --issue 35 --role manager --agent "Manny Scope" --detail "Created epic"

const fs = require('fs');
const path = require('path');

function findRepoRoot(start) {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return start;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1] || '';
  }
  return args;
}

function emit(args) {
  const root = findRepoRoot(process.cwd());
  const dir = path.join(root, '.dashboard');
  const file = path.join(dir, 'events.jsonl');

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const event = {
    ts: new Date().toISOString(),
    type: args.type || 'system',
    issue: args.issue ? Number(args.issue) : null,
    role: args.role || null,
    agent: args.agent || null,
    model: args.model || null,
    detail: args.detail || '',
  };

  fs.appendFileSync(file, JSON.stringify(event) + '\n');
  if (!args.quiet) {
    console.log(JSON.stringify(event));
  }
  return event;
}

// CLI mode
if (require.main === module) {
  const args = parseArgs(process.argv);
  emit(args);
}

// Module mode — importable by other scripts
module.exports = { emit, findRepoRoot };
