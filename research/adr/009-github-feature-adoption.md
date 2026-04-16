# ADR-009: GitHub Feature Adoption for devenv-ops

**Status**: Proposed
**Date**: 2026-04-16
**Author**: Quinn Critic (Consultant), Manny Scope (Manager)
**Epic**: #121

## Context

This repo primarily uses GitHub Issues + PRs. Several additional GitHub features
could improve governance, security, and team communication. This ADR evaluates
each for adoption fit.

## Features Evaluated

### Dependabot — ADOPT

**What**: Automated PRs to update `package.json` dependencies and pinned
GitHub Actions versions. Includes security vulnerability alerts.

**Fit**: High. `package.json` has Node.js dependencies (Alpine.js, dev scripts).
Stale deps introduce security risk. Dependabot costs nothing and automates a
boring hygiene task.

**Action**: Add `.github/dependabot.yml` targeting `npm` weekly + `github-actions`
weekly. Set assignee `chf3198`, label `type:dependency`.

### Emoji Reactions on Issues — ADOPT (already underway)

**What**: 👀🔧✅🎉 reactions on issues signal role state without noise.
Part of baton protocol per ADR-008 follow-up. Implemented in Epic #121.

### GitHub Discussions — DEFER

**What**: Forum-style threads separate from Issues. Good for Q&A, design
brainstorm, and announcements.

**Fit**: Low now. Solo/small team with no community. Issues serve all current
needs. Revisit when contributors > 3.

### Branch Protection Rulesets — ADOPT

**What**: Repository rulesets enforce required PR reviews, required status
checks, and branch naming conventions without Admin bypass.

**Fit**: High. Currently no branch protection. Enforce: `main` requires PR +
lint check pass. Use Ruleset (not legacy Branch Protection) for API-driven
control. Reference `github-ruleset-architecture` skill.

### Issue Templates — ADOPT

**What**: `.github/ISSUE_TEMPLATE/*.yml` files pre-fill label set, section
headers, and AC format for each ticket type.

**Fit**: High. Manager currently writes AC from scratch. Templates for
`type:task`, `type:research`, `type:bug` enforce governance structure.

### GitHub Actions CI — ADOPT (partial, existing)

**What**: CI workflow for lint gate on PR. Currently no workflow exists.

**Fit**: High. `npm run lint` is the only gate. A simple 10-line workflow
running lint on PR would prevent manual lint step being forgotten.

## Decision

| Feature | Decision | Priority |
|---|---|---|
| Dependabot | ✅ Adopt | P2 |
| Emoji reactions | ✅ Adopt | Done in #121 |
| Branch protection ruleset | ✅ Adopt | P1 |
| Issue templates | ✅ Adopt | P2 |
| CI lint workflow | ✅ Adopt | P1 |
| Discussions | ⏸ Defer | — |

## Consequences

- ADR-009 spawns 3 follow-up tickets: Dependabot config, ruleset setup, templates
- No breaking changes. All features are additive.
