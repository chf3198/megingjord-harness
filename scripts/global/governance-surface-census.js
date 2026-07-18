#!/usr/bin/env node
'use strict';
// tier: 1
// governance-surface-census.js (Epic #3807 / #3808) — READ-ONLY measurement of the harness's
// governance surface. It is the scoreboard the Epic's net-negative-surface invariant (AC-E4)
// is judged against: baseline it now, re-run after each retirement, require Δ <= 0 at close.
//
// SAFETY (catastrophe-precaution, binding): this module NEVER mutates a governed file. It only
// reads the repo and, optionally, writes ONE snapshot JSON to a path the caller names. Nothing
// here can weaken a gate — measuring is not cutting.
//
// Usage:
//   node governance-surface-census.js                 # human summary
//   node governance-surface-census.js --json          # machine snapshot to stdout
//   node governance-surface-census.js --snapshot P    # also write snapshot JSON to P
//   node governance-surface-census.js --baseline B    # print Δ vs a prior snapshot B
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');

// List tracked files via git (authoritative; ignores node_modules/dist/etc). Falls back to a
// bounded fs walk if git is unavailable (G6). Read-only either way.
function trackedFiles() {
  try {
    return execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').filter(Boolean);
  } catch {
    return walk(REPO).map((f) => path.relative(REPO, f));
  }
}

function walk(dir, acc = [], depth = 0) {
  if (depth > 8) return acc;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue;
    const entryPath = path.join(dir, e.name);
    if (e.isDirectory()) walk(entryPath, acc, depth + 1);
    else acc.push(entryPath);
  }
  return acc;
}

function readSafe(rel) {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch { return ''; }
}
function countLines(rel) {
  const text = readSafe(rel);
  return text ? text.split('\n').length : 0;
}

// A validator is advisory if its source signals non-blocking disposition. This mirrors the
// prose contract validators use ("advisory", "warns (never blocks)", "does not block",
// "pending-enforcement", "promotion ... gated"). Conservative: unknown -> treated as blocking.
const ADVISORY_RE = /advisory|warns?\s*\(never blocks|does not block|pending-enforcement|promotion (?:is )?(?:replay-eval-)?gated|ships?\s+advisory/i;

function censusValidators(files) {
  const validatorFiles = files.filter((f) => /^scripts\/global\/megalint\/.*\.js$/.test(f) && !/\.spec\./.test(f));
  let advisory = 0;
  const advisoryList = [];
  for (const file of validatorFiles) {
    if (ADVISORY_RE.test(readSafe(file))) { advisory += 1; advisoryList.push(file.replace('scripts/global/megalint/', '')); }
  }
  return { total: validatorFiles.length, advisory, blocking: validatorFiles.length - advisory, advisoryList };
}

// Distinct env-var flags used as bypass / override / disable / advisory switches across the
// governed surface. Names only — never values (G4). De-duplicated.
const FLAG_RE = /\b(MEGINGJORD_[A-Z0-9_]+|[A-Z][A-Z0-9]*_(?:BYPASS|DISABLED|OVERRIDE|ADVISORY|SKIP|ENABLE|ENABLED)|SKIP_[A-Z0-9_]+)\b/g;
// Strip line/block comments so a flag NAME merely mentioned in prose or a comment does not
// inflate the count (cross-family review finding, #3808 — the harness's prose-collision class).
// Over-counting would be safe-side for a net-negative invariant, but the scoreboard must be
// accurate, so we scan code/config, not commentary.
function stripComments(text) {
  return String(text || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // block comments
    .replace(/(^|\s)\/\/[^\n]*/g, ' ') // JS line comments
    .replace(/(^|\s)#[^\n]*/g, ' ');   // shell/py/yaml line comments
}
function censusFlags(files) {
  const scan = files.filter((f) => /^(scripts\/global\/.*\.js|hooks\/scripts\/.*\.py|instructions\/.*\.md|\.github\/workflows\/.*\.yml)$/.test(f));
  const set = new Set();
  for (const file of scan) {
    const matches = stripComments(readSafe(file)).match(FLAG_RE);
    if (matches) for (const flag of matches) set.add(flag);
  }
  // Names only, never values (G4): FLAG_RE captures the identifier token, not any assignment.
  return { distinct: set.size, sample: [...set].sort().slice(0, 30) };
}

// Resident-instruction load: the always-on set is CLAUDE.md + every instructions/*.md it
// @-imports (NOT the on-demand ones). The rest of instructions/ is on-demand.
function censusResident(instructionFiles) {
  const claudeMd = readSafe('CLAUDE.md');
  const residentRefs = [...claudeMd.matchAll(/@instructions\/([\w.-]+\.md)/g)].map((match) => `instructions/${match[1]}`);
  const residentFiles = ['CLAUDE.md', ...residentRefs];
  return {
    files: residentFiles.length,
    loc: residentFiles.reduce((total, file) => total + countLines(file), 0),
    list: residentFiles,
    instruction_files_total: instructionFiles.length,
    instruction_loc_total: instructionFiles.reduce((total, file) => total + countLines(file), 0),
    on_demand_files: instructionFiles.length - residentFiles.filter((file) => file.startsWith('instructions/')).length,
  };
}

function census() {
  const files = trackedFiles();
  const has = (re) => files.filter((file) => re.test(file));
  const validators = censusValidators(files);
  const resident = censusResident(has(/^instructions\/.*\.md$/));
  const flags = censusFlags(files);
  // Headline the invariant tracks: one validator, one resident-instruction file, and one bypass
  // flag each count as one unit of surface. LOC is reported separately (finer-grained).
  return {
    schema: 'governance-surface-census-v1',
    generated_note: 'READ-ONLY census; counts + paths only, no secret values (G4).',
    surface_units: validators.total + resident.files + flags.distinct,
    validators,
    workflows: has(/^\.github\/workflows\/.*\.yml$/).length,
    hooks: has(/^hooks\/scripts\/.*\.py$/).length,
    skills: new Set(has(/^skills\/[^/]+\//).map((file) => file.split('/')[1])).size,
    global_scripts: has(/^scripts\/global\/.*\.js$/).filter((file) => !/\.spec\./.test(file)).length,
    tests: has(/^tests\/.*\.spec\.js$/).length,
    resident_instructions: resident,
    bypass_flags: flags,
  };
}

// Δ vs a prior snapshot: negative on surface_units means the surface shrank (invariant target).
function delta(current, baseline) {
  const sub = (now, base) => (now || 0) - (base || 0);
  return {
    surface_units: sub(current.surface_units, baseline.surface_units),
    validators: sub(current.validators.total, baseline.validators.total),
    validators_advisory: sub(current.validators.advisory, baseline.validators.advisory),
    resident_files: sub(current.resident_instructions.files, baseline.resident_instructions.files),
    resident_loc: sub(current.resident_instructions.loc, baseline.resident_instructions.loc),
    bypass_flags: sub(current.bypass_flags.distinct, baseline.bypass_flags.distinct),
    net_negative: sub(current.surface_units, baseline.surface_units) <= 0,
  };
}

function fmt(c) {
  const resident = c.resident_instructions;
  return [
    '── Governance-surface census ─────────────────────────',
    `  surface units (validators+resident-files+flags) : ${c.surface_units}`,
    `  validators            : ${c.validators.total}  (advisory ${c.validators.advisory} / blocking ${c.validators.blocking})`,
    `  CI workflows          : ${c.workflows}`,
    `  hooks (py)            : ${c.hooks}`,
    `  skills                : ${c.skills}`,
    `  global scripts        : ${c.global_scripts}`,
    `  tests                 : ${c.tests}`,
    `  resident instructions : ${resident.files} files, ${resident.loc} LOC   (of ${resident.instruction_files_total} total, ${resident.instruction_loc_total} LOC)`,
    `  bypass/override flags : ${c.bypass_flags.distinct}`,
    '──────────────────────────────────────────────────────',
  ].join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const snapshot = census();
  const snapIdx = args.indexOf('--snapshot');
  if (snapIdx >= 0 && args[snapIdx + 1]) {
    fs.writeFileSync(args[snapIdx + 1], JSON.stringify(snapshot) + '\n'); // compact: machine snapshot
    process.stderr.write(`snapshot written: ${args[snapIdx + 1]}\n`);
  }
  const baseIdx = args.indexOf('--baseline');
  if (baseIdx >= 0 && args[baseIdx + 1]) {
    const base = JSON.parse(fs.readFileSync(args[baseIdx + 1], 'utf8'));
    console.log(JSON.stringify({ current: snapshot.surface_units, baseline: base.surface_units, delta: delta(snapshot, base) }, null, 2));
  } else if (args.includes('--json')) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(fmt(snapshot));
  }
}

module.exports = { census, delta, censusValidators, censusFlags, stripComments, ADVISORY_RE };
