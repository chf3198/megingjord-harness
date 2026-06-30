// tier: 1
// client-prompt-surface-check.js — Epic #3392 AC3.
//
// The harness retains a BOUNDED, enumerated set of human touchpoints (the 4 carve-outs in
// config/retained-human-touchpoints.json). Every other decision is operator-or-cross-model
// territory. This validator scans the hook layer for client-prompt surfaces (`emit("ask", ...)`)
// and flags any whose reason is NOT covered by a registered sanctioned surface — so a NEW
// client-prompt surface cannot be added silently.
//
// Ships ADVISORY: `validate()` returns the violation list, but the CLI exits 0 unless `--strict`
// is passed. Promotion to a blocking pre-merge gate is replay-eval-gated (never a calendar
// threshold). Fail-open: any scan/parse error yields no violations (an advisory scanner must
// never brick a run).
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_PATH = path.join(ROOT, 'config', 'retained-human-touchpoints.json');
// The hook files that may legitimately hold a sanctioned `emit("ask")`.
const DEFAULT_SCAN_FILES = ['hooks/scripts/pretool_guard.py'];
// Matches `emit("ask", "<reason>"` / `emit('ask', '<reason>'` across whitespace/newlines.
const ASK_RE = /emit\(\s*["']ask["']\s*,\s*["']([^"']+)["']/g;

/** Load the registry; fail-open to an empty registry on any error. */
function loadRegistry(registryPath = REGISTRY_PATH) {
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (_err) {
    return { carve_outs: [], sanctioned_ask_surfaces: [] };
  }
}

/** The registered sanctioned ask-surface markers. */
function registeredSurfaces(registry = loadRegistry()) {
  return (registry.sanctioned_ask_surfaces || []).map((s) => s.marker);
}

/** True when a scanned `emit("ask")` reason is covered by a registered surface marker. */
function isRegistered(reason, markers) {
  return markers.some((marker) => reason.includes(marker) || marker.includes(reason));
}

/**
 * Scan the given files for `emit("ask")` reasons not covered by the registry.
 * @param {string[]} [files] repo-relative paths (default: the hook layer)
 * @param {object} [opts] { registry, cwd }
 * @returns {Array<{file:string, reason:string}>} unregistered client-prompt surfaces
 */
function findUnregisteredAsks(files = DEFAULT_SCAN_FILES, opts = {}) {
  const registry = opts.registry || loadRegistry();
  const markers = registeredSurfaces(registry);
  const cwd = opts.cwd || ROOT;
  const out = [];
  for (const rel of files) {
    let src = '';
    try { src = fs.readFileSync(path.join(cwd, rel), 'utf8'); } catch (_err) { continue; }
    let match;
    ASK_RE.lastIndex = 0;
    while ((match = ASK_RE.exec(src)) !== null) {
      const reason = match[1];
      if (!isRegistered(reason, markers)) out.push({ file: rel, reason });
    }
  }
  return out;
}

/**
 * Validate the client-prompt surfaces against the registry.
 * @returns {{ok:boolean, violations:Array, advisory:boolean}}
 */
function validate(opts = {}) {
  try {
    const unregistered = findUnregisteredAsks(opts.files, opts);
    const violations = unregistered.map((u) => ({
      rule: 'unregistered-client-prompt-surface',
      severity: 'advisory',
      detail: `client-prompt surface in ${u.file} ("${u.reason.slice(0, 60)}…") is not in `
        + 'config/retained-human-touchpoints.json — register it under a carve-out or route the '
        + 'decision to the cross-model adjudication guardrail (Epic #3392 AC3).',
    }));
    return { ok: violations.length === 0, violations, advisory: true };
  } catch (_err) {
    return { ok: true, violations: [], advisory: true }; // fail-open
  }
}

module.exports = {
  loadRegistry, registeredSurfaces, isRegistered, findUnregisteredAsks, validate,
  REGISTRY_PATH, DEFAULT_SCAN_FILES,
};

if (require.main === module) {
  const strict = process.argv.includes('--strict');
  const result = validate();
  if (result.violations.length) {
    for (const violation of result.violations) {
      console.error(`[${violation.severity}] ${violation.rule}: ${violation.detail}`);
    }
  } else {
    console.log('client-prompt-surface-check: all client-prompt surfaces are registered.');
  }
  process.exit(strict && result.violations.length ? 1 : 0);
}
