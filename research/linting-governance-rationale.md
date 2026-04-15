# Research: Linting Governance Rationale

**Ticket**: #102 | **Epic**: #101 | **Date**: 2026-07-15

## 1. Why Enforce Globally?

### Current State Gap

DevEnv Ops manages 8+ repos but enforces only ≤100-line limit.
No documentation, style, or code quality linting exists.

### Problems Observed

1. **Zero inline doc enforcement** — 336 JS files, no JSDoc
2. **Inconsistent style** — home-harbor has ESLint; devenv-ops none
3. **docs-drift-maintenance gap** — omits inline code comments
4. **Agent context loss** — undocumented functions force re-reads
5. **Onboarding friction** — new repos get no lint baseline

### Industry Rationale

Google, Airbnb, Microsoft enforce JSDoc/TSDoc on public APIs.
PEP 257 + Google style require docstrings. ESLint recommended
is the de facto JS baseline. Ruff replaced flake8+isort+black.

## 2. Language Coverage Matrix

| Language | Files | Tool         | Doc Rules            |
|----------|-------|--------------|----------------------|
| JS       | 336   | ESLint v9    | eslint-plugin-jsdoc  |
| Python   | 27    | Ruff         | pydocstyle (D)       |
| Bash     | 34    | shellcheck   | Header comments      |
| CSS      | 24    | stylelint    | Section comments     |
| MD       | 492   | markdownlint | Structure rules      |
| TS       | 22    | ESLint v9+TS | eslint-plugin-jsdoc  |

## 3. Governance Tiers

| Tier | Scope | Priority | Tools |
|------|-------|----------|-------|
| T1 Docs | JSDoc, docstrings, headers | P0 | jsdoc, Ruff D |
| T2 Quality | eslint:recommended, F+E | P1 | ESLint, Ruff |
| T3 Style | Formatting, imports | P2 | Prettier, Ruff |

## 4. Standards Selected

- **JS/TS**: ESLint v9 flat config + eslint-plugin-jsdoc
- **Python**: Ruff with Google convention (D100-D419)
- **Bash**: shellcheck (already installed at /usr/bin)
- Severity: `warn` initially → `error` after retrofit

## 5. docs-drift-maintenance Integration

Add 5th surface: **Inline code documentation**
- JSDoc on public functions/methods (JS/TS)
- Python docstrings on public APIs
- File-header comments (Bash, CSS)
- Verification: lint pass confirms inline docs exist
