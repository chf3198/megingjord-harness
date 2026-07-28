#!/usr/bin/env node
'use strict';
// tier: 1
// flag-lifecycle-lint.js (#3795, Epic #3789 §3.4) — fails CI when a lane-created dark-launch
// flag is PAST its retire-by date yet still referenced in the tree. This closes the classic
// progressive-delivery failure mode where dead feature flags accumulate as branching debt:
// once a flag is flipped to 100%, the code path must become unconditional (flag removed) or the
// retire-by must be explicitly extended with justification. Reads config/flag-lifecycle.json.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const REGISTRY = path.join(REPO_ROOT, 'config', 'flag-lifecycle.json');

/** Load the lifecycle registry (fail-closed: a malformed/missing registry is a violation). */
function loadRegistry(file = REGISTRY) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { _error: e.message, flags: {} }; }
}

/** True when a flag name is still referenced anywhere in tracked code (excluding the registry). */
function isReferenced(flag, cwd = REPO_ROOT) {
  try {
    const out = execFileSync('git', ['grep', '-l', '--', flag], { cwd, encoding: 'utf8' });
    return out.split('\n').filter(Boolean).some((f) => !f.endsWith('flag-lifecycle.json'));
  } catch { return false; } // git grep exits non-zero when there are zero matches
}

/** Validate the registry against `now` (ISO date). Returns {ok, violations}. */
function validate({ now, registry, cwd } = {}) {
  const reg = registry || loadRegistry();
  const today = now || new Date().toISOString().slice(0, 10);
  const violations = [];
  if (reg._error) {
    return { ok: false, violations: [{ rule: 'flag-lifecycle-registry-unreadable', detail: reg._error }] };
  }
  for (const [flag, rec] of Object.entries(reg.flags || {})) {
    if (rec.state === 'retired') continue;
    if (rec.retire_by && rec.retire_by < today && isReferenced(flag, cwd)) {
      violations.push({ rule: 'flag-past-retire-by-still-referenced',
        detail: `flag "${flag}" is past retire_by ${rec.retire_by} but is still referenced. `
          + 'Remove the now-unconditional code path or extend retire_by with justification.' });
    }
  }
  return { ok: violations.length === 0, violations };
}

module.exports = { validate, loadRegistry, isReferenced, REGISTRY };

if (require.main === module) {
  const result = validate();
  if (!result.ok) {
    for (const violation of result.violations) process.stderr.write(`flag-lifecycle-lint: ${violation.rule} — ${violation.detail}\n`);
    process.exit(1);
  }
  process.stdout.write('flag-lifecycle-lint: all lane flags within lifecycle.\n');
}
