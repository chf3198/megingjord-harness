---
description: "Classify a repository by app type and route it to the correct standards branch, policy profile, and verification gates."
argument-hint: "[primary-type: website-static|web-app|library-sdk|infra-automation|auto-detect] [policy-profile: strict|standard|light] [overlays: security|collaboration|release|observability]"
---

# Repo Standards Router

## Purpose

Select the smallest correct standards stack for a repo, based on primary app type, overlapping overlays, and risk profile.

## Scope boundary

This skill is the router for **repository standards composition** (app-type + overlays), not the router for GitHub workflow governance.

- Owns: standards branch selection, verification gates, branch-promotion candidates.
- Does not own: ticket lifecycle execution, review/merge administration, ruleset architecture, merge queue readiness, Actions hardening.

If the request includes GitHub workflow governance controls, hand off to `github-ops-tree-router` after standards selection.

## Hard constraints

1. No broad policy rewrites in one pass.
2. Maximum 8 recommendations.
3. Must return explicit verification gates.
4. If repository type is unclear, return `NO_CHANGE` + missing evidence.
5. Prefer existing classes + overlays over creating a new branch.
6. For app-types with first-class versioned distribution channels, include a `version-selectability` control in release recommendations.

## Decision flow

1. Detect `primary_type` from runtime intent and repository artifacts.
2. Detect `secondary_types` only when overlap is clear and evidence-backed.
3. Apply `core-baseline` controls.
4. Apply primary-type controls from [APP-TYPE-SKILL-TREE.md](../APP-TYPE-SKILL-TREE.md).
5. Apply selected overlays (`security`, `collaboration`, `release`, optional `observability`).
6. Calibrate severity with `policy_profile`.
7. Emit actionable controls and checks.

## Handoff protocol

Set `handoff_required=yes` when any requested control includes:

- branch protection or rulesets,
- merge queue policy,
- Actions token/pinning/OIDC/runner hardening,
- ticket/PR lifecycle administration.

Then set `handoff_skill=github-ops-tree-router` and include a short reason.

## Output format (required)

```text
STANDARDS_ROUTER_REPORT
primary_type: <website-static|web-app|library-sdk|infra-automation>
secondary_types: <none|comma-separated types>
overlays: <none|security,collaboration,release,observability>
policy_profile: <strict|standard|light>
confidence: <high|medium|low>

selected_branches:
- core-baseline
- <primary-type-branch>
- <overlay-branches>

handoff:
- required: <yes|no>
- handoff_skill: <none|github-ops-tree-router>
- reason: <none|why governance routing is needed>

controls:
1) priority: <P1|P2|P3>
   area: <security|testing|docs|release|quality|accessibility|seo|supply-chain>
   change: <specific control>
   verification: <objective check>

missing_controls:
- <none or control gaps not yet covered by current branches>

skills_to_run_next:
- <none|web-regression-governance|repo-profile-governance|github-ops-tree-router|workflow-self-anneal>

decision:
- <apply|defer|NO_CHANGE>


---
*Full skill: `skills/repo-standards-router/SKILL.md` in devenv-ops.*