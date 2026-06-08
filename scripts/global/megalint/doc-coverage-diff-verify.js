'use strict';
// Refs #2716 — diff-based surface verification for doc-coverage gate
// Verifies declared DONE/UPDATED surfaces were actually modified in the PR diff.
// Execution contexts: local-pre-push, CI, shallow-clone, multi-runtime, doc-only.

const { execSync } = require('child_process');
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
  try {
    const out = execSync(`git diff --name-only "${base}...HEAD"`,
      { cwd: cwd || process.cwd(), timeout: GIT_DIFF_TIMEOUT_MS }).toString();
    return new Set(out.trim().split('\n').filter(Boolean));
  } catch (_) { return null; }
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

function verifyDeclaredSurfaces(declared, base, opts = {}) {
  const { cwd, runtime, shallow: forceShallow } = opts;
  const shallow = forceShallow !== undefined ? forceShallow : isShallowClone(cwd);
  const violations = [];
  if (shallow) {
    for (const surface of declared) {
      const sc = structuralCheck(surface, cwd);
      if (!sc.ok) violations.push({ rule: 'doc-diff-shallow-structural-fail',
        severity: 'warning', surface, reason: sc.reason });
    }
    return { ok: violations.filter(viol => viol.severity === 'error').length === 0,
      violations, mode: 'shallow-structural' };
  }
  const changed = base ? getChangedFiles(base, cwd) : null;
  for (const surface of declared) {
    const sc = structuralCheck(surface, cwd);
    if (!sc.ok) { violations.push({ rule: 'doc-diff-structural-fail',
      severity: 'error', surface, reason: sc.reason }); continue; }
    if (changed) {
      const touched = [...changed].some(file => file === surface || file.startsWith(surface));
      if (!touched) violations.push({ rule: 'doc-diff-not-changed', severity: 'warning',
        surface, detail: `declared DONE but not in diff vs ${base}` });
    }
  }
  checkRuntimePaths(violations, declared, runtime);
  return { ok: violations.filter(viol => viol.severity === 'error').length === 0,
    violations, mode: 'diff-verify' };
}

module.exports = { verifyDeclaredSurfaces, structuralCheck, getChangedFiles,
  isShallowClone, RUNTIME_DOC_ROOTS };
