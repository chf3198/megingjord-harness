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
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc, depth + 1);
    else acc.push(p);
  }
  return acc;
}

function readSafe(rel) {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch { return ''; }
}
function countLines(rel) {
  const t = readSafe(rel);
  return t ? t.split('\n').length : 0;
}

// A validator is advisory if its source signals non-blocking disposition. This mirrors the
// prose contract validators use ("advisory", "warns (never blocks)", "does not block",
// "pending-enforcement", "promotion ... gated"). Conservative: unknown -> treated as blocking.
const ADVISORY_RE = /advisory|warns?\s*\(never blocks|does not block|pending-enforcement|promotion (?:is )?(?:replay-eval-)?gated|ships?\s+advisory/i;

function censusValidators(files) {
  const v = files.filter((f) => /^scripts\/global\/megalint\/.*\.js$/.test(f) && !/\.spec\./.test(f));
  let advisory = 0;
  const advisoryList = [];
  for (const f of v) {
    if (ADVISORY_RE.test(readSafe(f))) { advisory += 1; advisoryList.push(f.replace('scripts/global/megalint/', '')); }
  }
  return { total: v.length, advisory, blocking: v.length - advisory, advisoryList };
}

// Distinct env-var flags used as bypass / override / disable / advisory switches across the
// governed surface. Names only — never values (G4). De-duplicated.
const FLAG_RE = /\b(MEGINGJORD_[A-Z0-9_]+|[A-Z][A-Z0-9]*_(?:BYPASS|DISABLED|OVERRIDE|ADVISORY|SKIP|ENABLE|ENABLED)|SKIP_[A-Z0-9_]+)\b/g;
function censusFlags(files) {
  const scan = files.filter((f) => /^(scripts\/global\/.*\.js|hooks\/scripts\/.*\.py|instructions\/.*\.md|\.github\/workflows\/.*\.yml)$/.test(f));
  const set = new Set();
  for (const f of scan) {
    const m = readSafe(f).match(FLAG_RE);
    if (m) for (const x of m) set.add(x);
  }
  return { distinct: set.size, sample: [...set].sort().slice(0, 30) };
}

function census() {
  const files = trackedFiles();
  const has = (re) => files.filter((f) => re.test(f));

  const validators = censusValidators(files);
  const workflows = has(/^\.github\/workflows\/.*\.yml$/).length;
  const hooks = has(/^hooks\/scripts\/.*\.py$/).length;
  const skills = new Set(has(/^skills\/[^/]+\//).map((f) => f.split('/')[1])).size;
  const globalScripts = has(/^scripts\/global\/.*\.js$/).filter((f) => !/\.spec\./.test(f)).length;
  const tests = has(/^tests\/.*\.spec\.js$/).length;

  // Resident-instruction LOC: the always-on set is CLAUDE.md + the @-referenced always-resident
  // instruction files (NOT the on-demand ones). We count CLAUDE.md + every instructions/*.md it
  // @-imports as resident; the rest of instructions/ is on-demand.
  const claudeMd = readSafe('CLAUDE.md');
  const residentRefs = [...claudeMd.matchAll(/@instructions\/([\w.-]+\.md)/g)].map((m) => `instructions/${m[1]}`);
  const residentFiles = ['CLAUDE.md', ...residentRefs];
  const residentLoc = residentFiles.reduce((n, f) => n + countLines(f), 0);
  const instructionFilesTotal = has(/^instructions\/.*\.md$/).length;
  const instructionLocTotal = has(/^instructions\/.*\.md$/).reduce((n, f) => n + countLines(f), 0);

  const flags = censusFlags(files);

  // The single headline number the invariant tracks. Weighted equally: one validator, one
  // resident-instruction *file*, and one bypass flag each count as one unit of surface. LOC is
  // reported separately (finer-grained) but the invariant uses the coarse count to avoid noise.
  const surfaceUnits = validators.total + residentFiles.length + flags.distinct;

  return {
    schema: 'governance-surface-census-v1',
    generated_note: 'READ-ONLY census; counts + paths only, no secret values (G4).',
    surface_units: surfaceUnits,
    validators,
    workflows,
    hooks,
    skills,
    global_scripts: globalScripts,
    tests,
    resident_instructions: {
      files: residentFiles.length, loc: residentLoc, list: residentFiles,
      instruction_files_total: instructionFilesTotal, instruction_loc_total: instructionLocTotal,
      on_demand_files: instructionFilesTotal - residentFiles.filter((f) => f.startsWith('instructions/')).length,
    },
    bypass_flags: flags,
  };
}

// Δ vs a prior snapshot: negative on surface_units means the surface shrank (invariant target).
function delta(current, baseline) {
  const d = (a, b) => (a || 0) - (b || 0);
  return {
    surface_units: d(current.surface_units, baseline.surface_units),
    validators: d(current.validators.total, baseline.validators.total),
    validators_advisory: d(current.validators.advisory, baseline.validators.advisory),
    resident_files: d(current.resident_instructions.files, baseline.resident_instructions.files),
    resident_loc: d(current.resident_instructions.loc, baseline.resident_instructions.loc),
    bypass_flags: d(current.bypass_flags.distinct, baseline.bypass_flags.distinct),
    net_negative: d(current.surface_units, baseline.surface_units) <= 0,
  };
}

function fmt(c) {
  const r = c.resident_instructions;
  return [
    '── Governance-surface census ─────────────────────────',
    `  surface units (validators+resident-files+flags) : ${c.surface_units}`,
    `  validators            : ${c.validators.total}  (advisory ${c.validators.advisory} / blocking ${c.validators.blocking})`,
    `  CI workflows          : ${c.workflows}`,
    `  hooks (py)            : ${c.hooks}`,
    `  skills                : ${c.skills}`,
    `  global scripts        : ${c.global_scripts}`,
    `  tests                 : ${c.tests}`,
    `  resident instructions : ${r.files} files, ${r.loc} LOC   (of ${r.instruction_files_total} total, ${r.instruction_loc_total} LOC)`,
    `  bypass/override flags : ${c.bypass_flags.distinct}`,
    '──────────────────────────────────────────────────────',
  ].join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const c = census();
  const snapIdx = args.indexOf('--snapshot');
  if (snapIdx >= 0 && args[snapIdx + 1]) {
    fs.writeFileSync(args[snapIdx + 1], JSON.stringify(c) + '\n'); // compact: machine snapshot
    process.stderr.write(`snapshot written: ${args[snapIdx + 1]}\n`);
  }
  const baseIdx = args.indexOf('--baseline');
  if (baseIdx >= 0 && args[baseIdx + 1]) {
    const base = JSON.parse(fs.readFileSync(args[baseIdx + 1], 'utf8'));
    console.log(JSON.stringify({ current: c.surface_units, baseline: base.surface_units, delta: delta(c, base) }, null, 2));
  } else if (args.includes('--json')) {
    console.log(JSON.stringify(c, null, 2));
  } else {
    console.log(fmt(c));
  }
}

module.exports = { census, delta, censusValidators, censusFlags, ADVISORY_RE };
