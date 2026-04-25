---
description: "Define and apply expert GitHub policy profiles and control catalogs used by specialized execution skills across ticketing, review/merge, governance, and release flows."
argument-hint: "[mode: triage|refinement|pre-pr|pre-merge|sprint-health|release-readiness|incident-flow|admin-audit] [scope: repo|team|org|enterprise] [policy-profile: strict|standard|light]"
---

# GitHub Ops Excellence

## Purpose

Provide a bounded, auditable policy and control catalog for high-quality GitHub execution across repositories.

## Hard constraints

1. No unbounded loops or recursive retries.
2. Maximum one full pass per invocation.
3. Maximum ten actionable recommendations per invocation.
4. No silent policy changes; propose changes with rationale.
5. No bypass escalation without explicit approval trail.
6. If required evidence is missing, return `NO_CHANGE` with missing artifacts.

## Modes

- `triage`: issue quality and planning readiness.
- `refinement`: backlog readiness and dependency hygiene.
- `pre-pr`: branch hygiene and PR preparation.
- `pre-merge`: review/check/ruleset merge readiness.
- `sprint-health`: flow health, WIP risk, and review throughput.
- `release-readiness`: release gate and rollback readiness.
- `incident-flow`: containment-to-follow-up issue flow during production incidents.
- `admin-audit`: governance/ruleset/admin posture review.

## Scope boundary (catalog ownership)

This skill is the **policy catalog owner**, not the primary executor.

Primary execution belongs to specialist skills selected by `github-ops-tree-router`.

This skill provides:

- policy-profile calibration (`strict|standard|light`)
- shared control definitions
- severity and verification standards
- conflict resolution guidance when specialists disagree

This skill is **not** the primary owner for repository profile/discoverability hygiene
(topics, homepage, social preview, community health file completeness). Delegate those to `repo-profile-governance`.

## Invocation order

1. For plan/feature-sensitive controls, run `github-capability-resolver` first.
2. Run `github-ops-tree-router` to select execution skill(s).
3. Apply `github-ops-excellence` as profile overlay to calibrate strictness and evidence requirements.

## Shared control packs by mode

### triage

- Issue title is a plain imperative sentence ≤72 chars — no `type(scope):` prefix (Conventional Commits belongs on commits/PRs, not issues).
- Issue title has no pseudo-prefixes (`[BUG]`, `[P1]`, `TICKET-123`, `JIRA-123`) and does not duplicate type in the title when a `type:*` label exists.
- GitHub `#N` is used as canonical ID; no parallel local ID schemes (`TICKET-NNN`, bracket tags, etc.) present.
- Issue includes: problem, expected outcome, acceptance criteria.
- Metadata includes: assignee, labels (priority + area + type), milestone/iteration, project link.
- Large work is decomposed with sub-issues/dependencies.
- Template/form adherence is verified; `blank_issues_enabled: false` confirmed in repo.

### refinement

- Backlog item has definition-of-ready (scope, acceptance, dependencies, risk).
- Parent/child issue relationships are coherent (sub-issues, dependencies).
- Priority and iteration fields are populated.
- Blocked work has explicit owner and next action.

### pre-pr

- One branch per concern.
- PR links issue(s) and states test evidence.
- PR template fields completed.
- Reviewers and code owners requested where applicable.

### pre-merge

- Required reviews satisfied.
- Required status checks passing on latest commit.
- Conversation resolution complete.
- Ruleset/branch-protection requirements satisfied.

---
*Full skill: `skills/github-ops-excellence/SKILL.md` in devenv-ops.*