# Linting Governance

Global enforcement of code quality, documentation, and style
standards across all DevEnv Ops-managed repositories.

## Core Principle

Every fleet repository uses the same lint rules, authored in
devenv-ops and distributed via shared configs. Lint configs are
the "source of truth" — repos copy them, never override.

## Governance Tiers

| Tier | Scope | Priority |
|------|-------|----------|
| T1 — Documentation | JSDoc, docstrings, file headers | P0 |
| T2 — Code Quality | eslint:recommended, Ruff F+E, shellcheck | P1 |
| T3 — Style | Formatting, import ordering | P2 |

## Toolchain

- **JS/TS**: ESLint v9 flat config + eslint-plugin-jsdoc
- **Python**: Ruff (pydocstyle D rules, Google convention)
- **Bash**: shellcheck
- **CSS**: stylelint
- **Markdown**: markdownlint

## Architecture

```
devenv-ops/lint-configs/     → Each repo's lint-configs/
  eslint.config.devenv.js       (copied, hash-verified)
  ruff.devenv.toml
  .shellcheckrc
```

## Integration Points

- [[docs-drift-maintenance]] — 5th surface: inline code docs
- [[governance-enforcement]] — CI gates block on lint failure
- [[repo-onboarding-standards]] — new repos get configs

## Related

- Epic #101: Global linting governance
- Research: `research/linting-governance-rationale.md`
- Research: `research/linting-governance-implementation.md`
