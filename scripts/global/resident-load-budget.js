#!/usr/bin/env node
'use strict';
// tier: 1
// resident-load-budget.js (Epic #3807 / child #3812, C4) — treat the always-resident instruction
// LOC as a BUDGETED resource, and provide a FAIL-CLOSED on-demand loader so a rule migrated out of
// the resident set is never silently lost when the dependent operation needs it.
//
// SAFETY (catastrophe-precaution, binding): READ-ONLY. This module never mutates a governed file.
// It reads CLAUDE.md + instructions/, and the committed census baseline for the budget ceiling.
// Migrating a rule resident->on-demand keeps the rule (the file stays in instructions/); only its
// always-on load is retired, so the resident LOC drops WITHOUT dropping any governance rule.
//
// Usage:
//   node resident-load-budget.js                 # budget status (advisory)
//   node resident-load-budget.js --strict        # exit 1 if over budget
//   node resident-load-budget.js --load <name>   # fail-closed load one on-demand instruction
//   node resident-load-budget.js --require <op>  # fail-closed load every rule an operation needs
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const claudeMdPath = path.join(repoRoot, 'CLAUDE.md');
const instructionsDir = path.join(repoRoot, 'instructions');
const baselineSnapshotPath = path.join(repoRoot, 'governance', 'surface-census-baseline.json');

// Thrown when a migrated on-demand rule cannot be loaded at the moment a dependent operation needs
// it. Callers MUST treat this as a hard block/warn — never proceed as if the rule were satisfied.
class OnDemandLoadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OnDemandLoadError';
  }
}

// On-demand operation -> the instruction rule(s) that operation depends on. Each rule listed here
// is intentionally NOT always-resident; it is loaded (fail-closed) only when its operation runs.
// The migrated C4 rule (resource-tier-portability) is keyed to the operation that actually needs
// it: choosing/declaring a resource tier or its baseline-absent fallback.
const ON_DEMAND_RULES = {
  'resource-tier-selection': ['resource-tier-portability.instructions.md'],
  'web-surface-change': ['visual-qa-governance.instructions.md'],
  'browser-automation': ['playwright-mcp-low-resource.instructions.md'],
  'security-mapping': ['owasp-agentic-mapping.instructions.md'],
  'repo-onboarding': ['repo-health-onboarding.instructions.md'],
};

function readText(absPath) {
  return fs.readFileSync(absPath, 'utf8');
}

function lineCount(absPath) {
  return readText(absPath).split('\n').length;
}

// The always-resident instruction set = CLAUDE.md + every instructions/*.md it @-imports.
function residentInstructionFiles() {
  const claudeMd = readText(claudeMdPath);
  const imported = [...claudeMd.matchAll(/@instructions\/([\w.-]+\.md)/g)].map((match) => match[1]);
  return ['CLAUDE.md', ...imported.map((name) => path.join('instructions', name))];
}

// The budget ceiling is the committed baseline resident LOC (the scoreboard the Epic is judged
// against). Fail-open to Infinity if the baseline is unreadable so the budget never blocks work.
function budgetCeiling() {
  try {
    return JSON.parse(readText(baselineSnapshotPath)).resident_instructions.loc;
  } catch {
    return Infinity;
  }
}

// Current always-resident LOC vs the budget ceiling. within=true means the resident load fits.
function checkBudget() {
  const files = residentInstructionFiles();
  const loc = files.reduce((total, rel) => {
    const abs = path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
    try {
      return total + lineCount(abs);
    } catch {
      return total;
    }
  }, 0);
  const budget = budgetCeiling();
  return { files: files.length, loc, budget, within: loc <= budget, headroom: budget - loc };
}

// Fail-closed load of a single on-demand instruction. Returns its content; THROWS OnDemandLoadError
// if the rule file is absent or empty — so a migrated rule can never be silently skipped. baseDir is
// the instructions directory (overridable in tests to exercise the absent/empty guard paths).
function loadOnDemand(name, baseDir = instructionsDir) {
  const abs = path.join(baseDir, name);
  let content;
  try {
    content = readText(abs);
  } catch (err) {
    throw new OnDemandLoadError(`on-demand rule '${name}' failed to load (${err.code || 'read-error'}); operation must block`);
  }
  if (!content.trim()) {
    throw new OnDemandLoadError(`on-demand rule '${name}' is empty; operation must block rather than proceed without the rule`);
  }
  return { name, loc: content.split('\n').length, content, loaded: true };
}

// Fail-closed load of every rule a dependent operation needs. An unknown operation THROWS (a caller
// asking for rules of an operation the map does not cover must not proceed unguarded).
function requireForOperation(operation) {
  const names = ON_DEMAND_RULES[operation];
  if (!names) {
    throw new OnDemandLoadError(`unknown on-demand operation '${operation}'; refusing to proceed without a rule mapping`);
  }
  return names.map((name) => loadOnDemand(name));
}

function formatBudget(status) {
  return [
    '── Resident-load budget ──────────────────────────────',
    `  resident files : ${status.files}`,
    `  resident LOC   : ${status.loc}  (budget ${status.budget}, headroom ${status.headroom})`,
    `  within budget  : ${status.within ? 'yes' : 'NO — over budget'}`,
    '──────────────────────────────────────────────────────',
  ].join('\n');
}

function runCli(argv) {
  const loadIdx = argv.indexOf('--load');
  if (loadIdx >= 0 && argv[loadIdx + 1]) {
    const loaded = loadOnDemand(argv[loadIdx + 1]);
    process.stdout.write(`loaded on-demand: ${loaded.name} (${loaded.loc} LOC)\n`);
    return 0;
  }
  const reqIdx = argv.indexOf('--require');
  if (reqIdx >= 0 && argv[reqIdx + 1]) {
    const rules = requireForOperation(argv[reqIdx + 1]);
    process.stdout.write(`operation '${argv[reqIdx + 1]}' loaded ${rules.length} rule(s): ${rules.map((rule) => rule.name).join(', ')}\n`);
    return 0;
  }
  const status = checkBudget();
  process.stdout.write(`${formatBudget(status)}\n`);
  return argv.includes('--strict') && !status.within ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exit(runCli(process.argv.slice(2)));
  } catch (err) {
    process.stderr.write(`${err.name || 'Error'}: ${err.message}\n`);
    process.exit(2);
  }
}

module.exports = {
  OnDemandLoadError,
  ON_DEMAND_RULES,
  residentInstructionFiles,
  budgetCeiling,
  checkBudget,
  loadOnDemand,
  requireForOperation,
};
