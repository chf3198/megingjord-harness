#!/usr/bin/env node
'use strict';
// split-test-runner.js — runs Playwright specs via npx playwright test
// and node:test specs via node --test, preventing cross-framework
// module-state pollution. Refs #3166.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const TESTS = path.join(ROOT, 'tests');

function findSpecs(dir) {
  const result = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { result.push(...findSpecs(full)); continue; }
    if (e.name.endsWith('.spec.js')) result.push(full);
  }
  return result;
}

function classify(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('@playwright/test')) return 'playwright';
  return 'node';
}

function run(argv) {
  const verbose = argv.includes('--verbose');
  const nodeOnly = argv.includes('--node-only');
  const pwOnly = argv.includes('--pw-only');
  const passthrough = argv.filter(
    a => !['--verbose', '--node-only', '--pw-only'].includes(a)
  );

  const all = findSpecs(TESTS);
  const pw = [];
  const nt = [];
  for (const f of all) {
    if (classify(f) === 'playwright') pw.push(f);
    else nt.push(f);
  }

  if (verbose) {
    process.stderr.write(
      `[split-runner] ${pw.length} playwright, ${nt.length} node:test\n`
    );
  }

  let ok = true;

  if (!nodeOnly && pw.length) {
    const args = ['playwright', 'test', ...passthrough];
    const r = spawnSync('npx', args, {
      cwd: ROOT, stdio: 'inherit', encoding: 'utf8',
    });
    if (r.status !== 0) ok = false;
  }

  if (!pwOnly && nt.length) {
    const rel = nt.map(f => path.relative(ROOT, f));
    const r = spawnSync('node', ['--test', ...rel], {
      cwd: ROOT, stdio: 'inherit', encoding: 'utf8',
    });
    if (r.status !== 0) ok = false;
  }

  return ok;
}

if (require.main === module) {
  const ok = run(process.argv.slice(2));
  process.exit(ok ? 0 : 1);
}

module.exports = { run, findSpecs, classify };
