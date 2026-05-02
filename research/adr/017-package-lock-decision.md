# ADR-017: package-lock.json — Commit vs. Gitignore Decision

**Status**: Proposed
**Date**: 2026-05-02
**Ticket**: #822 (implementation child of Epic #818, scoped from #819 research)

## Context

`package-lock.json` has been gitignored at the repo root since the initial seed commit (`514e364`, 2026-04-11). This is **non-standard** for a Node.js project: npm's official guidance and ecosystem convention is to commit the lockfile for reproducible installs and Dependabot integration.

Recent observation: branch refs like `dependabot/npm_and_yarn/eslint-10.2.1`, `dependabot/npm_and_yarn/markdownlint-cli2-0.22.1`, and `dependabot/npm_and_yarn/eslint-plugin-jsdoc-62.9.0` exist (force-updated repeatedly) but **no corresponding open PRs**. Dependabot's npm ecosystem cannot complete a PR without a committed lockfile to update — strong evidence that the gitignore is **silently breaking** automated dependency PRs for the npm ecosystem (GitHub Actions ecosystem PRs, which don't need a lockfile, are working).

## Options Considered

### Option A — Keep gitignored

- Preserves current install flow (each user runs `npm install`).
- Multi-runtime sync (claude/codex/copilot) doesn't need to coordinate lockfile updates.
- Each operator's Node version produces a lock matching their environment.

**Cost**: Dependabot npm ecosystem silently broken; no reproducible CI installs; drift between dev environments is unobserved.

### Option B — Commit `package-lock.json`

- Restores Dependabot npm ecosystem (PRs get opened with lockfile updates).
- Reproducible CI / fresh-clone installs.
- Standard ecosystem convention; lower onboarding friction for contributors.

**Cost**: Every future PR that touches dependencies must regenerate and commit the lockfile. Slight increase in PR surface area. CI must enforce that `npm install` produces no diff in the lockfile.

### Option C — Use `npm shrinkwrap`

- Equivalent to committing `package-lock.json` semantically; rarely used in 2026 for non-published apps.

Rejected: same trade-offs as Option B without the broader ecosystem alignment.

## Decision

**Recommend Option B (commit the lockfile)**, but **defer the actual flip to a separate, isolated PR** that includes:

1. Removing `package-lock.json` from `.gitignore`.
2. Committing the current `package-lock.json` produced by Node 22 (the pinned `.nvmrc` + `package.json#engines`).
3. Adding a CI step that runs `npm install --frozen-lockfile` (or equivalent) to verify the lockfile stays in sync.
4. Confirming Dependabot npm PRs start opening after the flip.

This ADR documents the decision and the deferred action. This ticket (#822) lands the ADR only; the flip lives in a follow-up child created when an admin can verify the fresh-clone install path in CI.

## Consequences

### Positive (when the flip lands)

- Dependabot npm ecosystem starts working.
- Reproducible installs across dev + CI.
- Standard ecosystem convention; one less surprise for new contributors.

### Negative

- PRs that change dependencies must regenerate the lockfile (small overhead).
- Initial flip may surface previously-unnoticed dependency drift; baseline that drift in the flip PR.

## Out of scope

- The actual flip — separate follow-up child ticket per the deferred-action note above.
- Migration to pnpm / yarn — not on the table.

## Sources

- npm v11 docs on lockfile: <https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json>
- Dependabot npm ecosystem requirements: <https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference>
- Megingjord branch evidence: `dependabot/npm_and_yarn/*` refs without paired PRs (observed 2026-05-02 via `git fetch origin`).

## Related

- Epic #818 (codebase organization)
- #819 (research that flagged the lockfile decision)
- ADR-013 (capability detection substrate — independent but related to install ergonomics)

Refs #822, #818
