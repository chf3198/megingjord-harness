'use strict';
// Refs #2716 — diff-based surface verification for doc-coverage gate
// Verifies declared DONE/UPDATED surfaces were actually modified in the PR diff.
// Execution contexts: local-pre-push, CI, shallow-clone, multi-runtime, doc-only.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const GIT_DIFF_TIMEOUT_MS = 10000;
const MIN_DOC_BYTES = 300;

const RUNTIME_DOC_ROOTS = {
  copilot: ['docs/', 'wiki/', 'instructions/', '.github/copilot-instructions.md'],
  codex: ['docs/', '.codex/', 'AGENTS.md'],
  'claude-code': ['docs/', '.claude/', 'CLAUDE.md'],
};

function isShallowClone(cwd) {
  try { return fs.existsSync(path.join(cwd || process.cwd(), '.git', 'shallow')); }
  catch (_) { return false; }
}

function getChangedFiles(base, cwd) {
  const proc = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`],
    { cwd: cwd || process.cwd(), timeout: GIT_DIFF_TIMEOUT_MS, encoding: 'utf8' });
  if (proc.error || proc.status !== 0) return null;
  return new Set((proc.stdout || '').trim().split('\n').filter(Boolean));
}

function structuralCheck(filePath, cwd) {
  try {
    const full = path.join(cwd || process.cwd(), filePath);
    if (!fs.existsSync(full)) return { ok: false, reason: 'file-not-found' };
    const content = fs.readFileSync(full, 'utf8');
    if (content.length < MIN_DOC_BYTES) return { ok: false, reason: 'too-short', bytes: content.length };
    if (!/^#{1,6}\s/m.test(content)) return { ok: false, reason: 'no-section-headers' };
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

function checkRuntimePaths(violations, declared, runtime) {
  if (!runtime || !RUNTIME_DOC_ROOTS[runtime]) return;
  const roots = RUNTIME_DOC_ROOTS[runtime];
  for (const surface of declared) {
    if (!roots.some(root => surface.startsWith(root) || surface === root.replace(/\/$/, '')))
      violations.push({ rule: 'doc-diff-runtime-path-mismatch', severity: 'warning',
        surface, detail: `not under expected ${runtime} doc roots: ${roots.join(', ')}` });
  }
}

// A changed file "covers" a surface when it equals the surface (root file) or sits
// under it (directory surface). The `/`-boundary guard prevents `docs` matching
// `docs-other.md` — the unanchored startsWith would over-match. #3121 hardening.
function surfaceTouched(surface, changed) {
  const stem = String(surface).replace(/\/+$/, '');
  return [...changed].some(file => file === stem || file === surface || file.startsWith(`${stem}/`));
}

// #3121: accept a pre-fetched changed-file set (opts.changedFiles) so the check runs in
// the PR-API-driven CI context (filenames already in hand, no git base / spawn needed).
function verifyDeclaredSurfaces(declared, base, opts = {}) {
  const { cwd, runtime, shallow: forceShallow, changedFiles, structural = true } = opts;
  const shallow = forceShallow !== undefined ? forceShallow : isShallowClone(cwd);
  const violations = [];
  if (shallow && structural) {
    for (const surface of declared) {
      const sc = structuralCheck(surface, cwd);
      if (!sc.ok) violations.push({ rule: 'doc-diff-shallow-structural-fail',
        severity: 'warning', surface, reason: sc.reason });
    }
    return { ok: violations.filter(viol => viol.severity === 'error').length === 0,
      violations, mode: 'shallow-structural' };
  }
  const preFetched = changedFiles ? new Set(changedFiles) : null;
  const changed = preFetched || (base ? getChangedFiles(base, cwd) : null);
  for (const surface of declared) {
    if (structural) {
      const sc = structuralCheck(surface, cwd);
      if (!sc.ok) { violations.push({ rule: 'doc-diff-structural-fail',
        severity: 'error', surface, reason: sc.reason }); continue; }
    }
    if (changed && !surfaceTouched(surface, changed))
      violations.push({ rule: 'doc-diff-not-changed', severity: 'error',
        surface, detail: `declared DONE but not in diff${base ? ` vs ${base}` : ''}` });
  }
  checkRuntimePaths(violations, declared, runtime);
  return { ok: violations.filter(viol => viol.severity === 'error').length === 0,
    violations, mode: 'diff-verify' };
}

module.exports = { verifyDeclaredSurfaces, structuralCheck, getChangedFiles,
  isShallowClone, surfaceTouched, RUNTIME_DOC_ROOTS };
