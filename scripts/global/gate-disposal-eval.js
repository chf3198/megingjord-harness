#!/usr/bin/env node
'use strict';
// tier: 1
// gate-disposal-eval.js (Epic #3807 C3 / #3811) — the GATE DISPOSAL PATH: the missing
// symmetric half of gate promotion. Promotion moves an advisory validator UP to blocking
// once replay-eval precision >= floor. Disposal moves a NON-promoting or REDUNDANT advisory
// validator DOWN to a retirement-candidate so the surface can shrink (Epic #3807 mechanism 3:
// "half-built advisory gates never finish — full cost, no protection").
//
// SAFETY (catastrophe-precaution, binding):
//  - READ-ONLY. This module FLAGS candidates; it NEVER deletes or edits a validator.
//  - FAIL-SAFE. A validator's disposition is `retain` UNLESS positive evidence says otherwise:
//    a reviewed redundancy finding, OR below-floor replay precision after >= N eligible windows.
//  - A BLOCKING gate is NEVER a retirement-candidate here — retiring a live control is the
//    security-weakening human touchpoint, out of this tool's autonomous scope.
//  - A flagged retirement-candidate is a PROPOSAL: the actual retirement still runs the full
//    baton + a cross-family `merge-consensus` receipt confirming no G1/G4 control is weakened.
//
// Usage:
//   node gate-disposal-eval.js                 # human table of advisory-validator dispositions
//   node gate-disposal-eval.js --json          # machine list to stdout
//   node gate-disposal-eval.js --candidates    # only retirement-candidates (exit 0 always)
const fs = require('node:fs');
const path = require('node:path');
const { censusValidators, ADVISORY_RE } = require('./governance-surface-census.js');

const REPO = path.resolve(__dirname, '..', '..');

// A validator whose replay-eval precision stays below this floor after N eligible windows is
// failing promotion and not improving — a retirement-candidate (symmetry with the promotion gate,
// which promotes at precision >= this floor). Never calendar-based (Epic #1771 replay-over-soak).
const PRECISION_FLOOR = 0.85;
const NOT_PROMOTED_WINDOW_FLOOR = 3;

// Reviewed redundancy findings: an advisory validator whose ENTIRE property is strictly dominated
// by one or more BLOCKING gates provides zero incremental protection. Each entry is a measured,
// cross-family-verifiable claim (MEASURE -> VERIFY -> CUT), not an inference. Adding an entry is a
// reviewed act; the tool consults this registry the way the promotion side consults replay-eval.
const REVIEWED_REDUNDANCY = {
  'worktree-naming-advisory.js': {
    dominatedBy: ['hooks/scripts/validate-branch-name.sh', '.github/workflows/branch-name.yml'],
    reason: 'advisory-only branch-name warner; both blocking gates REJECT any non-conforming branch '
      + 'before it lands, so the advisory can never fire on a branch that passed them. Its unique '
      + 'per-team-namespace accepted shape is itself rejected by the blocking CI gate (dead feature).',
    ticket: '#3811',
  },
};

function readSafe(rel) {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch { return ''; }
}

// A dominating gate is only credited if it still exists on disk (guards against a stale registry
// pointing at a since-removed gate — never claim redundancy against a gate that is itself gone).
function liveDominators(entry) {
  if (!entry || !Array.isArray(entry.dominatedBy)) return [];
  return entry.dominatedBy.filter((gate) => readSafe(gate).length > 0);
}

// Disposition for one advisory validator. Positive-evidence-only; default retain.
function evaluateValidator(fileName, replay) {
  const redundancy = REVIEWED_REDUNDANCY[fileName];
  const dominators = liveDominators(redundancy);
  if (dominators.length > 0) {
    return {
      validator: fileName,
      disposition: 'retirement-candidate',
      basis: 'reviewed-redundancy',
      reasons: [`property dominated by blocking gate(s): ${dominators.join(', ')}`, redundancy.reason],
    };
  }
  if (replay && typeof replay.precision === 'number') {
    if (replay.precision >= PRECISION_FLOOR) {
      return { validator: fileName, disposition: 'promotion-candidate', basis: 'replay-precision',
        reasons: [`replay precision ${replay.precision} >= floor ${PRECISION_FLOOR}`] };
    }
    if ((replay.windows || 0) >= NOT_PROMOTED_WINDOW_FLOOR) {
      return { validator: fileName, disposition: 'retirement-candidate', basis: 'below-floor-non-promoting',
        reasons: [`precision ${replay.precision} < floor ${PRECISION_FLOOR} after ${replay.windows} windows`] };
    }
  }
  return { validator: fileName, disposition: 'retain', basis: 'insufficient-evidence',
    reasons: ['no reviewed redundancy finding and no below-floor replay signal'] };
}

// Evaluate every advisory validator the census reports. `replayByValidator` is an optional map of
// fileName -> {precision, windows}; absent entries fall through to redundancy / retain (fail-safe).
function evaluateAll(replayByValidator = {}) {
  const files = execTrackedFiles();
  const advisoryList = censusValidators(files).advisoryList;
  return advisoryList
    .filter((fileName) => ADVISORY_RE.test(readSafe(`scripts/global/megalint/${fileName}`)))
    .map((fileName) => evaluateValidator(fileName, replayByValidator[fileName]));
}

function execTrackedFiles() {
  const { execSync } = require('node:child_process');
  try {
    return execSync('git ls-files', { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function fmt(rows) {
  const lines = ['── Gate disposal-path evaluation (advisory validators) ──'];
  for (const row of rows) {
    lines.push(`  ${row.disposition.padEnd(20)} ${row.validator}  [${row.basis}]`);
  }
  const candidates = rows.filter((row) => row.disposition === 'retirement-candidate').length;
  lines.push(`  ── ${rows.length} advisory validators, ${candidates} retirement-candidate(s) ──`);
  return lines.join('\n');
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const rows = evaluateAll();
  if (args.includes('--candidates')) {
    console.log(JSON.stringify(rows.filter((row) => row.disposition === 'retirement-candidate'), null, 2));
  } else if (args.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(fmt(rows));
  }
}

module.exports = {
  evaluateValidator,
  evaluateAll,
  liveDominators,
  REVIEWED_REDUNDANCY,
  PRECISION_FLOOR,
  NOT_PROMOTED_WINDOW_FLOOR,
};
