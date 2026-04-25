---
description: "Enforce file organization, naming conventions, and app-type-specific project layouts. Use when creating, restructuring, or onboarding a repository."
argument-hint: "[app-type: vscode-extension|node-library|shell-tool|static-site|web-app|python-project|monorepo] [mode: audit|scaffold|remediate]"
---

# Repo Structure Conventions

## Purpose

Ensure every managed repository has a consistent, navigable, industry-standard file organization. This skill is the **primary owner** for structural layout, naming, and build-artifact isolation.

## When to invoke

- Creating a new repository.
- Restructuring an existing repository.
- Onboarding a repo that lacks clear organization.
- After `repo-onboarding-standards` classifies the app type.

## Scope boundary

### Owns (primary authority)

- Root-level file layout and ordering.
- Directory naming conventions.
- App-type-specific directory structures.
- Build artifact isolation (.gitignore, .vscodeignore, .npmignore).
- CODEOWNERS patterns by project size and structure.

### Delegates (do NOT duplicate)

| Concern | Owner |
|---|---|
| Community health files (README, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, SUPPORT) | `repo-profile-governance` |
| Discoverability metadata (description, topics, social preview, homepage) | `repo-profile-governance` |
| GitHub Actions security (SHA pinning, token permissions, OIDC) | `github-actions-security-hardening` |
| Secret hygiene (.env, credentials, artifact leaks) | `secret-exposure-prevention` |
| Documentation content quality and drift detection | `docs-drift-maintenance` |
| Release versioning, tags, and publish integrity | `release-version-integrity` |
| CI/CD workflow design and merge gates | `github-review-merge-admin` |

## Hard constraints

1. No unbounded loops or recursive retries.
2. Maximum one full repository audit per invocation.
3. No silent file creation; produce explicit proposals for review.
4. Never move or rename files without confirming the change won't break imports, CI, or published paths.
5. Prefer the smallest structural change that achieves the convention.

## Modes

- **audit**: Detect structural gaps and deviations. Return findings ranked by severity.
- **scaffold**: Generate the initial directory structure for a new project given an app type.
- **remediate**: Propose minimal file moves/renames to bring an existing repo into compliance.

---

## A) Universal file layout

### Root minimalism principle

A file belongs at the repository root **only** if at least one of these conditions is true:

| Condition | Examples |
|---|---|
| **Tool enforcement** — a tool will not find the file elsewhere | `package.json`, `Cargo.toml`, `go.mod`, `.gitignore` |
| **Platform convention** — GitHub/GitLab renders or processes it from root | `README.md`, `LICENSE`, `CHANGELOG.md`, `CODEOWNERS` |
| **Ecosystem standard name** — the ecosystem's toolchain expects it at root | `tsconfig.json`, `pyproject.toml`, `.editorconfig`, `Makefile` |
| **Primary entry point** — the project has ≤ 3 source files and no `src/` dir | `mem-watchdog.sh`, `install.sh`, `main.py` |

All other files belong in a purpose-named directory (`docs/`, `scripts/`, `test/`, `src/`, `.github/`).

**Audit behavior**: Root files failing this test are flagged at `low` severity (informational). The finding recommends which directory the file should move to, but does not block merges.

**Cross-ecosystem consensus**: Rust (`src/`, `tests/`), Go (`cmd/`, `internal/`, `test/`), Python (`src/<pkg>/`, `tests/`), JS/TS (`src/`, `test/`), .NET (`src/`, `test/`), and the kriasoft Folder-Structure-Conventions standard (2k★, 5.8k forks) all converge on this layout: source and tests in subdirectories, root contains only files that must be there.

Every repository must have this root-level structure (files may be absent if N/A):

```
README.md                  ← required (content owned by repo-profile-governance)
LICENSE                    ← required when distributing
CHANGELOG.md               ← required; Keep a Changelog format
.gitignore                 ← required
.github/
  copilot-instructions.md  ← repo-specific Copilot context
  instructions/            ← stack-specific Copilot rules

---
*Full skill: `skills/repo-structure-conventions/SKILL.md` in devenv-ops.*