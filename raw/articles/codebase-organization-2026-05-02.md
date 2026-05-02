---
title: "Codebase Organization — 2026-Q2 Best Practices Research"
type: research
created: 2026-05-02
status: pending
tags: [codebase, organization, governance, install-ergonomics]
---

# Codebase Organization — 2026-Q2 Best Practices Research

**Date**: 2026-05-02
**Ticket**: #819 (research child of Epic #818)
**Lane**: docs-research

## Goal

Survey 2026-Q2 best practices for organizing a multi-runtime, multi-language, public-installable code base, then audit Megingjord against the findings to scope implementation children.

## 1. Modern Node.js project layout (2025-2026)

- `bin/` for executable entrypoints, `src/` (TS) **or** `lib/` (JS) for runtime code, `scripts/` for **maintainer/CI utilities only**, `test/` for tests, `docs/` for shipped documentation.
- Multi-package products use `packages/<name>` (npm 11 / pnpm workspaces).
- `package.json#exports` replaces `main`; subpath patterns standard.

Sources: [oclif/oclif](https://github.com/oclif/oclif), [npm/cli](https://github.com/npm/cli), [anthropics/claude-code/scripts/](https://github.com/anthropics/claude-code), [google-gemini/gemini-cli/packages/](https://github.com/google-gemini/gemini-cli/tree/main/packages), [n8n-io/n8n/packages/](https://github.com/n8n-io/n8n/tree/main/packages), [Node packages docs](https://nodejs.org/api/packages.html).

**Anti-pattern**: mixing `src/` and `lib/` for the same code path; product code under `scripts/`.

## 2. Multi-runtime / multi-language layout

- One manifest per runtime at root (`package.json`, `pyproject.toml`, `Cargo.toml`, etc.).
- Per-language code in `<lang>/` dirs (`python/`, `crates/`) or `packages/<name>` for JS-internal modules.
- `Makefile` is the polyglot entrypoint at the repo root.
- Hooks/instructions/agents live as peer top-level dirs (current Copilot-style).

Sources: [vercel/vercel](https://github.com/vercel/vercel), [super-linter/super-linter](https://github.com/super-linter/super-linter), [github/awesome-copilot](https://github.com/github/awesome-copilot), [kubernetes/kubernetes](https://github.com/kubernetes/kubernetes), [opentofu/opentofu](https://github.com/opentofu/opentofu), [cli/cli](https://github.com/cli/cli).

## 3. Public-installable harness patterns (Anthropic / Claude Code)

- Plugin manifest **only** under `.claude-plugin/plugin.json`. Peer dirs `skills/`, `agents/`, `commands/`, `hooks/`, `monitors/`, `bin/`, `.mcp.json`, `.lsp.json`, `settings.json`. Do NOT nest `commands/`, `agents/`, `skills/`, `hooks/` inside `.claude-plugin/`.
- `.claude/settings.json` (project-shared, committed) vs `.claude/settings.local.json` (gitignored personal). Array values concatenate across scopes; scalars override by precedence (managed > CLI > local > project > user).
- Templates / public-installable surface lives in `templates/` (peer to `src/`), never embedded in `src/`.

Sources: [Anthropic Claude Code Plugins reference](https://code.claude.com/docs/en/plugins), [Claude Code settings docs](https://code.claude.com/docs/en/settings), [oclif/oclif templates/](https://github.com/oclif/oclif).

**Anti-pattern**: `commands/`, `agents/`, `skills/`, `hooks/` nested inside `.claude-plugin/`.

## 4. Secret / local-state separation in 2026

- `.env.example` committed; `.env*` (except `.example`) gitignored.
- `.secrets.baseline` committed; pre-commit `detect-secrets-hook` with `--baseline`.
- `.gitleaks.toml` + `.gitleaksignore` (fingerprint-based) at root.
- GitHub push-protection enabled by default for public repos; rotation > history removal.
- dotenv (motdotla): one `.env` per environment, no inheritance. dotenvx (encrypted, committable) recommended for production.

Sources: [motdotla/dotenv](https://github.com/motdotla/dotenv), [Yelp/detect-secrets](https://github.com/Yelp/detect-secrets), [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks), [GitHub secret-scanning docs](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning).

**Anti-pattern**: `.env.local` checked in; cascading `.env`-inheritance configs.

## 5. Artifact isolation

- Universally gitignored: `dist/`, `build/`, `out/`, `coverage/`, `.cache/`, `node_modules/`.
- One lockfile per workspace at root.
- Per-tool ignore files for publish/build context: `.dockerignore`, `.npmignore`, `.vercelignore`.

Sources: [vercel/vercel/.gitignore](https://github.com/vercel/vercel), [pnpm workspaces](https://pnpm.io/workspaces), [npm v11 workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces), [Docker best practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/).

## 6. Repo configuration files

- `.editorconfig` — universal, always present.
- `mise.toml` — recommended single source for tool version pins (preferred over `.tool-versions`).
- `.nvmrc` — kept for CI compat.
- `package.json#engines` — advisory floor (only enforced with `engine-strict=true`).

Sources: [editorconfig.org](https://editorconfig.org/), [mise docs](https://mise.jdx.dev/configuration.html), [npm v11 engines docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#engines).

**Best practice**: pick one tool-version pinning convention; co-existence with `.nvmrc` is acceptable for CI.

## 7. CI/CD config

- Reusable workflows for full pipelines; composite actions for step sequences.
- Group workflows by event/purpose prefix (`triage-*`, `release-*`, `cron-*`).
- 30+ workflow files at scale is normal; single mega-workflow is the anti-pattern.

Sources: [GitHub Actions reusing workflows](https://docs.github.com/en/actions/sharing-automations/avoiding-duplication), [google-gemini/gemini-cli workflows](https://github.com/google-gemini/gemini-cli/tree/main/.github/workflows), [cli/cli workflows](https://github.com/cli/cli/tree/main/.github/workflows).

## 8. Documentation organization

- `docs/` — user-facing.
- `research/` or `rfc/` — decisions, peer to `docs/`.
- Root: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`.
- `AGENTS.md` (+ `CLAUDE.md`, `GEMINI.md`) — emerging cross-AI-tool root convention.
- Wiki content versioned in-repo (not GitHub Wiki) for change-tracking.

Sources: [opentofu/opentofu](https://github.com/opentofu/opentofu), [kubernetes/kubernetes](https://github.com/kubernetes/kubernetes), [cli/cli AGENTS.md](https://github.com/cli/cli), [n8n-io/n8n CLAUDE.md](https://github.com/n8n-io/n8n).

## Megingjord audit (current state)

| Surface | Current | Best-practice fit | Recommendation |
|---|---|---|---|
| Top-level layout | 25+ peer dirs | High volume but flat — no `src/` overload | KEEP flat polyglot peers. Add `src/` only if multi-package emerges. |
| `scripts/` | mixed — entrypoints + utilities + nested `global/`, `wiki/`, `fleet/` | `scripts/` should be maintainer-only | KEEP — current contents are maintainer/CI tools, not product code. ✅ |
| `agents/`, `skills/`, `hooks/`, `instructions/`, `commands/` | peer top-level dirs | Matches Claude Code plugin convention | KEEP. ✅ |
| `.claude/` vs `.claude-plugin/` | `.claude/` for settings + worktrees only | Matches | KEEP. ✅ |
| `tickets/` (70 files) | committed local ticket markdown | Drift risk: GitHub `#N` is canonical | **MOVE** to gitignored `.tickets/` or remove entirely; canonical baton lives in GitHub issues. |
| `model-compare/` (model design analysis) | committed | Looks like research notes | **MOVE** to `research/model-compare/` or gitignore as local. |
| `NAMING_RESEARCH_2026.md` (root) | committed root-level research | Should be in `research/` | **MOVE** to `research/`. |
| `templates/vscode-profiles/` | committed user-installable | Matches `templates/` convention | KEEP. ✅ |
| `.env`, `.env.example` | both at root | `.env` should be gitignored, `.example` committed | VERIFY `.env` is gitignored; ✅ already in `.gitignore`. |
| `.secrets.baseline` | not present | Best practice for any public repo | **ADD** detect-secrets baseline + pre-commit hook. |
| `.gitleaks.toml` | not present | Optional but valuable | **ADD** as enhancement. |
| `.editorconfig` | **MISSING** | Universal | **ADD**. |
| `.nvmrc` | present, pinned to Node 22 | Standard | KEEP. ✅ |
| `mise.toml` | not present | Recommended single-source for tool pinning | Optional follow-up. |
| `.github/workflows/` (26 files) | grouped by purpose | Within normal range | KEEP. ✅ |
| `logs/` (committed dir) | committed but `.gitignore` lists `logs/` | Inconsistent | **VERIFY** `logs/` empty in repo; ensure no committed log files. |
| `.dashboard/` | gitignored, contains `it-notes/`, capabilities, dashboard.pid | Local-only state | KEEP — already correctly gitignored. ✅ |
| `playwright-report/`, `test-results/` | gitignored | Standard | KEEP. ✅ |
| `node_modules/`, `package-lock.json` | gitignored | non-standard for `package-lock.json`! | **DECIDE**: most projects commit `package-lock.json` for reproducibility. Currently gitignored — investigate why and decide. |
| `Dockerfile`, `compose.yaml` | root | Standard | KEEP. ✅ |
| Root markdowns: `AGENTS.md`, `CLAUDE.md`, `WIKI.md`, `README.md`, `CHANGELOG.md` | all root | Matches AGENTS.md convention | KEEP. ✅ |
| `CHANGELOG-archive.md` | root | OK; alternative is `CHANGELOG/archive.md` | KEEP. |

## Priority list for implementation children

| # | Surface | Priority | Risk | Notes |
|---|---|---|---|---|
| A | `tickets/` (70 markdown files) | **P1** | low | Canonical baton is GitHub `#N`; local files drift |
| B | `model-compare/`, `NAMING_RESEARCH_2026.md`, root research | **P2** | low | Move to `research/` for consistency |
| C | `.secrets.baseline` + pre-commit detect-secrets hook | **P2** | low | Adds defense in depth |
| D | `.editorconfig`, `.nvmrc` standardization | **P3** | very low | Cross-tool consistency |
| E | `package-lock.json` decision (commit vs gitignore) | **P2** | medium | Affects reproducibility; needs explicit ADR |
| F | `logs/` cleanup audit | **P3** | very low | Verify nothing committed |
| G | `.gitleaks.toml` (optional enhancement) | **P3** | very low | Beyond detect-secrets |

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Moving `tickets/` breaks references in older docs/wiki | Medium | grep for `tickets/` references first; replace with GitHub `#N` links |
| Committing `package-lock.json` breaks current install flow | Low | Document as ADR; test fresh-clone install in CI |
| Moving `model-compare/` to `research/` breaks any internal links | Low | grep + update |
| detect-secrets baseline flags existing committed strings | Medium | Run baseline once, accept current state, gate forward |

## Honest gaps (where Megingjord differs from 2026 norms)

- **`tickets/` is non-standard** — most modern projects rely entirely on GitHub Issues. This is unique to Megingjord's earlier offline-first phase.
- **Lockfile gitignored** — uncommon; needs ADR to document the decision (or revert).
- **No `.editorconfig` at root** — confirmed missing; universal in mature repos; cheap to add.
- **No `.secrets.baseline`** — standard now for public repos.

## Sources

All citations inline above. Primary sources only: GitHub repository URLs, official documentation (docs.github.com, code.claude.com, docs.npmjs.com, pnpm.io, mise.jdx.dev, editorconfig.org, nodejs.org/api, docs.docker.com), and primary maintainer READMEs.

## Compose with prior epics

- Phase 0–7 of Epic #795 already established docs:compile, docs:anchors, docs:exec, log4brains, vale style pack, Issue Forms cleanup. This research only addresses **structure/organization**, not content quality.
- Diátaxis IA audit (#802) covered docs/ reorganization separately; this research includes that surface only at the top-level structural rotation.

Refs #819, #818
