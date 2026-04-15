# Research: Implementation Mechanism — Tooling & Config

**Ticket**: #103 | **Epic**: #101 | **Date**: 2026-07-15

## 1. Tooling Selection

### JavaScript/TypeScript: ESLint v9 Flat Config
- **Package**: `eslint` + `eslint-plugin-jsdoc`
- **Config**: `eslint.config.js` (flat, shareable as JS module)
- home-harbor uses ESLint v8; migration is a separate ticket

### Python: Ruff
- Single binary (~25MB), replaces flake8+isort+black
- Config via `ruff.toml` with Google docstring convention

### Bash: shellcheck
- Already at `/usr/bin/shellcheck`. Zero setup.

## 2. Resource Impact (penguin-1, 6.3GB RAM)

| Tool       | Install | Runtime | Speed    |
|------------|---------|---------|----------|
| ESLint     | ~50MB   | ~100MB  | <5s      |
| Ruff       | ~25MB   | ~30MB   | <1s      |
| shellcheck | present | ~10MB   | <1s      |
| **Total**  | ~75MB   | ~140MB  | <7s      |

Fits constraints. mem-watchdog safe.

## 3. Shared Config Architecture

Configs live in `devenv-ops/lint-configs/`, copied to repos:

```
devenv-ops/lint-configs/
  eslint.config.devenv.js
  ruff.devenv.toml
  .shellcheckrc
```

**Decision**: Copy into each repo (self-contained CI).
Drift detected by `scripts/lint-sync.js` (SHA-256 hashes).

## 4. ESLint Config Design

Key rules: `jsdoc/require-jsdoc` (publicOnly), `max-lines`
(100), `no-unused-vars` (ignore `_` prefix).
Extends `jsdoc.configs['flat/recommended']`.

## 5. Ruff Config Design

Select rules: F (pyflakes), E (pycodestyle), W (warnings),
D (pydocstyle), I (isort). Convention: Google.
Per-file ignore: `tests/*` exempt from D rules.

## 6. CI Workflow Template

Shared `.github/workflows/lint.yml`:
1. `npx eslint . --config lint-configs/eslint.config.devenv.js`
2. `ruff check --config lint-configs/ruff.devenv.toml`
3. `shellcheck scripts/**/*.sh`

New `lint:full` npm script combines ESLint + ≤100-line check.
