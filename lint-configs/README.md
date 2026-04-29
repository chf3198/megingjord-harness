# lint-configs/README.md — DevEnv Ops shared lint configuration bundle

Source of truth for all fleet repository linting governance.
Managed in devenv-ops; distributed to fleet repos via deploy.sh.

## Contents

| File                      | Tool           | Languages | Tier                       |
| ------------------------- | -------------- | --------- | -------------------------- |
| `eslint.config.devenv.js` | ESLint v9      | JS, TS    | T1 JSDoc + T2 Quality      |
| `ruff.devenv.toml`        | Ruff           | Python    | T1 Docstrings + T2 Quality |
| `ci-lint.yml`             | GitHub Actions | all       | CI enforcement template    |

## Deployment

Copy all files to the target repo's `lint-configs/` directory:

```bash
# From devenv-ops after changes
npm run deploy:apply
```

For opt-in downstream repos, use the harness installer (dry-run by default):

```bash
npm run toolchain:readability:install -- --target=/path/to/repo
npm run toolchain:readability:install -- --target=/path/to/repo --apply
```

Hash-based drift detection is planned via `scripts/lint-sync.js` (Phase 2).

## Per-repo wiring

In the target repo's `package.json`:

```json
"scripts": {
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "lint:readability": "node scripts/lint-readability.js",
  "lint:js": "eslint -c lint-configs/eslint.config.devenv.js .",
  "lint:py": "ruff check --config lint-configs/ruff.devenv.toml .",
  "lint:sh": "find . -name '*.sh' -not -path './node_modules/*' -exec shellcheck {} +",
  "lint:all": "npm run format:check && npm run lint:js && npm run lint:py && npm run lint:sh"
}
```

## Governance tiers

- **T1 (P0)**: JSDoc on JS public fns, Python docstrings — required
- **T2 (P1)**: eslint:recommended, Ruff F+E rules — required
- **T3 (P2)**: Formatting checks (`prettier --check`) — required for opted-in repos

## Related

- Epic #101: Global linting governance
- Skill: `skills/docs-drift-maintenance/SKILL.md` (inline-docs surface)
- Research: `research/linting-governance-tooling.md`
