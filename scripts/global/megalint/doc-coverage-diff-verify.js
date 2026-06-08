'use strict';
// Refs #2716 — diff-based surface verification for doc-coverage gate
// Verifies declared DONE/UPDATED surfaces were actually modified in the PR diff.
// Execution contexts: local-pre-push, CI, shallow-clone, multi-runtime, doc-only.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Multi-runtime doc path conventions (#2716 AC)
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
      { cwd: cwd || process.cwd(), timeout: 10000 }).toString();
    return new Set(out.trim().split('\n').filter(Boolean));
  } catch (_) { return null; }
}

function structuralCheck(filePath, cwd) {
  try {
    const full = path.join(cwd || process.cwd(), filePath);
    if (!fs.existsSync(full)) return { ok: false, reason: 'file-not-found' };
    const content = fs.readFileSync(full, 'utf8');
    if (content.length < 300) return { ok: false, reason: 'too-short', bytes: content.length };
    if (!/^#{1,6}\s/m.test(content)) return { ok: false, reason: 'no-section-headers' };
    return { ok: true };
  } catch (e) { return { ok: false, reason: e.message }; }
}

function verifyDeclaredSurfaces(declared, base, opts = {}) {
  const { cwd, runtime, shallow: forceShallow } = opts;
  const shallow = forceShallow !== undefined ? forceShallow : isShallowClone(cwd);
  const violations = [];
  if (shallow) {
    // Shallow clone: diff unavailable; fall back to structural check only
    for (const surface of declared) {
      const sc = structuralCheck(surface, cwd);
      if (!sc.ok) violations.push({ rule: 'doc-diff-shallow-structural-fail',
        severity: 'warning', surface, reason: sc.reason });
    }
    return { ok: violations.filter(v => v.severity === 'error').length === 0,
      violations, mode: 'shallow-structural' };
  }
  const changed = base ? getChangedFiles(base, cwd) : null;
  for (const surface of declared) {
    const sc = structuralCheck(surface, cwd);
    if (!sc.ok) { violations.push({ rule: 'doc-diff-structural-fail',
      severity: 'error', surface, reason: sc.reason }); continue; }
    if (changed) {
      const touched = [...changed].some(f => f === surface || f.startsWith(surface));
      if (!touched) violations.push({ rule: 'doc-diff-not-changed', severity: 'warning',
        surface, detail: `declared DONE but not in diff vs ${base}` });
    }
  }
  if (runtime && RUNTIME_DOC_ROOTS[runtime]) {
    const roots = RUNTIME_DOC_ROOTS[runtime];
    for (const surface of declared) {
      if (!roots.some(r => surface.startsWith(r) || surface === r.replace(/\/$/, ''))) {
        violations.push({ rule: 'doc-diff-runtime-path-mismatch', severity: 'warning',
          surface, detail: `not under expected ${runtime} doc roots: ${roots.join(', ')}` });
      }
    }
  }
  return { ok: violations.filter(v => v.severity === 'error').length === 0,
    violations, mode: 'diff-verify' };
}

module.exports = { verifyDeclaredSurfaces, structuralCheck, getChangedFiles,
  isShallowClone, RUNTIME_DOC_ROOTS };
