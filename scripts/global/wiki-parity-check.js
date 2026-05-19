#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const HOME = os.homedir();

const WIKI_PATHS = {
  copilot: path.join(HOME, '.copilot', 'wiki'),
  codex: path.join(HOME, '.codex', 'devenv-ops', 'wiki'),
  'claude-code': path.join(HOME, '.copilot', 'wiki'),
};

const SEARCH_SCRIPTS = {
  copilot: path.join(HOME, '.copilot', 'scripts', 'wiki-search.js'),
  codex: path.join(HOME, '.codex', 'devenv-ops', 'scripts', 'wiki-search.js'),
  'claude-code': null,
};

const REQUIRED_SUBDIRS = ['concepts', 'entities'];

function exists(filePath) { return fs.existsSync(filePath); }

function add(findings, id, severity, summary, evidence, recommendation) {
  findings.push({ id, severity, summary, evidence, recommendation });
}

function checkRuntime(findings, rt) {
  const wikiPath = WIKI_PATHS[rt];
  const indexFile = path.join(wikiPath, 'index.md');
  if (!exists(indexFile)) {
    const severity = rt === 'claude-code' ? 'medium' : 'high';
    const fix = rt === 'copilot' ? 'npm run deploy:apply'
      : rt === 'codex' ? 'npm run deploy:codex:apply'
      : 'Ensure Copilot runtime wiki is deployed (cross-runtime read)';
    add(findings, `wiki-${rt}-index-missing`, severity,
      `${rt} wiki index.md is missing at ${wikiPath}.`,
      `Expected: ${indexFile}`, fix);
  }
  const searchScript = SEARCH_SCRIPTS[rt];
  if (searchScript && !exists(searchScript)) {
    const fix = rt === 'copilot' ? 'npm run deploy:apply' : 'npm run deploy:codex:apply';
    add(findings, `wiki-${rt}-search-missing`, 'medium',
      `${rt} wiki-search.js is not deployed.`,
      `Expected: ${searchScript}`, fix);
  }
  if (rt === 'claude-code') return;
  for (const sub of REQUIRED_SUBDIRS) {
    if (!exists(path.join(wikiPath, sub))) {
      const fix = rt === 'copilot' ? 'npm run deploy:apply' : 'npm run deploy:codex:apply';
      add(findings, `wiki-${rt}-${sub}-missing`, 'medium',
        `${rt} wiki is missing required subdirectory: ${sub}.`,
        `Expected: ${path.join(wikiPath, sub)}`, fix);
    }
  }
}

function run() {
  const findings = [];
  for (const rt of ['copilot', 'codex', 'claude-code']) checkRuntime(findings, rt);
  return {
    ok: findings.length === 0,
    surface: 'wiki_docs_memory',
    checkedAt: new Date().toISOString(),
    wikiPaths: WIKI_PATHS,
    findings,
  };
}

if (require.main === module) {
  const result = run();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else for (const finding of result.findings) process.stdout.write(`${finding.severity}: ${finding.id} - ${finding.summary}\n`);
  process.exit(process.argv.includes('--strict') && !result.ok ? 1 : 0);
}

module.exports = { run, WIKI_PATHS, SEARCH_SCRIPTS, REQUIRED_SUBDIRS };
