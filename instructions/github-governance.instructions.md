---
name: GitHub Governance
description: Always-on GitHub governance rules for ticket lifecycle, review/merge gates, Actions security, project linkage, and release flow. Distilled from 9 specialized GitHub skills.
applyTo: "**"
---
# GitHub Governance

## Issue titles — plain imperative (never Conventional Commits)

- Issue titles are plain imperative sentences ≤72 chars: `Fix header nav contrast on dark backgrounds`
- **No** `type(scope):` prefix on issues — that belongs on commits/PRs only.
- **No** bracket tags (`[BUG]`, `[P1]`), parallel IDs (`TICKET-NNN`), or type duplication when a `type:*` label exists.
- GitHub `#N` is the sole canonical ticket identifier. No parallel local ID schemes.

## Commits and PR titles — Conventional Commits

- Format: `type(scope): imperative description` ≤72 chars.
- Allowed types: `feat` `fix` `chore` `content` `perf` `refactor` `docs` `style` `test`.
- Branch naming: `<type>/<issue-number>-<short-slug>` (e.g. `fix/5-nav-contrast`).

## Ticket lifecycle gates

- Every change needs a linked issue with taxonomy label (`type:*`), priority label, domain label, milestone, and project assignment before coding starts.
- PR requires `Refs #N`, milestone, labels, and gate-suite evidence. Use `Refs` not `Closes` — issue close is Consultant authority via `gh issue close` after CONSULTANT_CLOSEOUT.
- Issues must include: problem/objective, expected outcome, acceptance criteria.
- Large work is decomposed with sub-issues and `blocked by` / `blocking` dependencies.
- Templates required: at minimum bug, task, and epic forms. `blank_issues_enabled: false` in config.yml.

## Review and merge gates

- Required reviewers/approvals satisfied before merge.
- Required status checks green on the latest commit.
- All review conversations resolved.
- Rulesets/branch protection requirements satisfied.
- Merge method follows repo policy.

## Actions security baseline

- `GITHUB_TOKEN`: default to read permissions; elevate per-job only when required.
- Third-party actions: pin to full commit SHA where policy requires.
- Prefer OIDC over long-lived static cloud credentials.
- CODEOWNERS coverage for `.github/workflows/`.
- No auto-remediation that broadens permissions.
- **Label-lint enforcement**: `.github/workflows/label-lint.yml` runs on all `issues`
  events and enforces ADR-010 label rules (single status, single role, no execution
  role on terminal closed/backlog items). Violations post a comment and fail the check.

## Release and incident flow

- Changelog/release notes prepared before tagging.
- Release evidence (tests/checks/artifacts) linked to release item.
- Rollback path and owner documented.
- Incident items include severity, impact, owner, and containment plan.
- Hotfix branch/PR linked to incident issue with validation evidence.
- Follow-up prevention tickets created before incident closure.

## Project linkage

- Project items have status, priority, iteration, and owner fields populated.
- Issue ↔ branch and issue ↔ PR linkage maintained in the Development panel.
- Built-in workflows: auto-add, status sync, auto-archive configured where available.

## Capability-first routing

- Before recommending rulesets or plan-sensitive features, run `github-capability-resolver` to verify availability.
- Route workflow governance requests through `github-ops-tree-router`; invoke `github-ruleset-architecture` for ruleset design.
