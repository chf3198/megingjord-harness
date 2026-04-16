# lint-baseline.md — Established 2026-04-15 (Epic #101, #110)
# Existing violations waived for incremental adoption.
# New/changed files must be clean. Reduce counts in forward-fix ticket #111.

## ESLint baseline (devenv-ops, 2026-04-15)
- Total: 208 problems (94 errors, 114 warnings)
- Scope: dashboard/js, scripts/global, scripts/wiki
- Primary sources:
  - 94 errors: no-undef (cross-file browser globals, Alpine.js pattern)
  - 114 warnings: missing JSDoc, no-unused-vars (browser multi-script pattern)
- Waiver: existing code is waived; all NEW functions in PRs must be clean
- Forward-fix: #111 — ESLint baseline remediation (JS module refactor)

## Ruff baseline (hooks/scripts/, 2026-04-15)
- 1 warning: F401 unused import `re` in commit_ticket_gate.py
- 1 warning: E402 module-level import not at top
- All waived — existing scripts; new scripts must be clean

## shellcheck (scripts/, 2026-04-15)
- 0 issues — all passing after SC2155/SC2162 fixes in this PR
