# ADR-018: Enable GitHub Actions to create and approve pull requests

**Status**: Accepted
**Date**: 2026-05-03
**Ticket**: #840 (implementing)

## Context

`release-please` (googleapis/release-please-action) opens a release PR on every main push. This requires `pull-requests: write` (declared in the workflow) **and** the repo-level setting *Allow GitHub Actions to create and approve pull requests* (`can_approve_pull_request_reviews=true`). The workflow declaration alone is insufficient — the repo-level toggle overrides it.

Prior state on this repo: `default_workflow_permissions=read`, `can_approve_pull_request_reviews=false`. Symptom: every release-please run since #783 silently failed with `GitHub Actions is not permitted to create or approve pull requests`. Latest auto-tag was v3.3.7; the [Unreleased] CHANGELOG block (covering #774, #830, #818-cluster, #833) could not be auto-tagged.

## Decision

Set the repo-level Actions permission as follows:

```sh
gh api -X PUT /repos/chf3198/megingjord-harness/actions/permissions/workflow \
  -F default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=true
```

- `default_workflow_permissions=read` — keeps the least-privilege baseline. Workflows that need write must declare it per-job (existing convention; e.g., release-please.yml already does).
- `can_approve_pull_request_reviews=true` — unblocks release-please and any future workflow that legitimately needs to open or approve PRs.

## Consequences

### Positive

- release-please ships unblocked; auto-tag flow restored.
- No reduction of `default_workflow_permissions` baseline; per-job permissions remain the contract.
- Future workflows (e.g., dependabot, repo-meta-sync from #800) that need PR-creation work without further repo-setting changes.

### Negative / risks

(Risk register fleet-drafted via Groq llama-3.3-70b, refined for context.)

- **Unauthorized PR approvals**: any workflow can now approve PRs via `GITHUB_TOKEN`. Mitigation: branch-protection requires CODEOWNER review for protected paths; required-status-checks include `consultant-gate` which blocks merge on missing CONSULTANT_CLOSEOUT.
- **Malicious workflow creates a release PR**: third-party action could try to open a release-style PR. Mitigation: `permissions: read-all` baseline + per-job elevation; pinned-SHA policy (per-job audit catches drift); `googleapis/release-please-action` already pinned by SHA in this repo.
- **Compromised dependency injects a PR**: if a devDependency action is compromised, it could open a PR. Mitigation: dependabot + package-lock.json (now committed via #830) + npm audit baseline; required reviews still gate merge.
- **Approval ring-fencing bypass**: `can_approve_pull_request_reviews=true` lets `GITHUB_TOKEN`-issuing workflows approve their own PRs in theory. Mitigation: GitHub does not count `GITHUB_TOKEN`-issued approvals toward branch-protection required reviews — required reviewers must still be human (or signed by a CODEOWNER user, not the bot). This is the documented behavior.
- **Repo metadata exposure**: writes to repo via `GITHUB_TOKEN` are bounded to `pull-requests: write`-declared workflows; not a permission expansion of arbitrary write paths.
- **Audit signal**: every PR open/approve event is logged to repo audit log. Operators can query `gh api repos/.../audit-log` (when on Enterprise) or fall back to PR-history grep for off-pattern actor (`github-actions[bot]`).

### Verification

After the API call, confirm:

1. `gh api /repos/chf3198/megingjord-harness/actions/permissions/workflow` returns `can_approve_pull_request_reviews: true`.
2. Manually dispatch the `release-please` workflow; confirm a release-please PR is created (currently expected to bump v3.3.7 → v3.4.0 against the [Unreleased] block).

## Alternatives considered

- **Use a Personal Access Token with `repo`+`workflow` scopes** in the release-please workflow. Rejected: PATs require rotation and tie the workflow to a user identity. Repo-setting flip is more durable.
- **Drop release-please** in favor of manual `gh release create`. Rejected: release-please's CHANGELOG-driven version bump is a load-bearing convention here.
- **Self-host a separate "release bot" GitHub App**. Rejected: heavyweight for a single-workflow need.

## Out of scope

- Branch-protection ruleset reshape (separate decision; ADR-009 + ADR-010 cover today's posture).
- Adding `permissions:` blocks to workflows that don't have them (separate sweep).

## Sources

- [GitHub docs — managing GitHub Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#preventing-github-actions-from-creating-or-approving-pull-requests)
- [release-please-action README](https://github.com/googleapis/release-please-action)
- ADR-009 (GitHub Feature Adoption) — broader posture this fits within

Refs #840, #830
