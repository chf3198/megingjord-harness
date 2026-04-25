---
description: "Audit and harden repository profile, community health, discoverability metadata, and contribution surfaces across repos using bounded, evidence-based checks."
argument-hint: "[mode: profile-audit|profile-remediate|profile-weekly-check] [scope: repo|org] [visibility: public|private] [policy-profile: strict|standard|light]"
---

# Repo Profile Governance

## Purpose

Provide a bounded governance pass for repository presentation and collaboration readiness:

- profile quality (`description`, `homepage`, topics, social preview)
- community health files (`CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, `SUPPORT`)
- contribution surfaces (issue/PR templates, config, ownership cues)
- consistency across repositories

## Hard constraints

1. No unbounded loops or recursive retries.
2. Maximum one full repository pass per invocation.
3. Maximum ten recommendations per invocation.
4. No silent policy mutation; produce explicit, auditable proposals.
5. No claims of completion without verification evidence.
6. If required artifacts are missing, return `NO_CHANGE` with missing evidence.

## Modes

- `profile-audit`: detect profile/community gaps and rank by severity.
- `profile-remediate`: propose minimal, ordered remediation steps for top gaps.
- `profile-weekly-check`: compact drift check for recurring hygiene regressions.

## Scope boundary (primary ownership)

This skill is the **primary owner** for repository profile hygiene:

- About metadata quality (`description`, homepage, topics)
- discoverability surfaces (social preview, naming clarity)
- contributor-facing files and templates
- community-health baseline and consistency across repos

This skill is **not** the primary owner for branch protection/rulesets, merge gates,
release readiness, or incident execution flow. Delegate those to `github-ops-excellence`.

## Required checks

### A) Repository profile & discoverability

- About `description` is concise and accurate.
- `homepage` is set when applicable.
- Topics are present, normalized, and relevant.
- Social preview image exists and is intentional (not fallback-only).

### B) Community health baseline

- Presence of `README.md` with clear purpose and quick-start/usage context.
- Presence (repo root or `.github/`) of:
  - `CONTRIBUTING.md`
  - `CODE_OF_CONDUCT.md`
  - `SECURITY.md`
  - `SUPPORT.md`
- `LICENSE` exists when distribution requires it.

### C) Contribution surfaces

- Issue templates exist and are aligned to common workflows.
- PR template exists and enforces evidence/checklist quality.
- `.github/CODEOWNERS` exists for critical paths.

### D) Governance consistency

- Critical standards are consistent across target repos.
- Deviations are documented and intentional.
- Missing items are prioritized by impact:
  - P1: security/reporting or contributor-blocking
  - P2: discoverability/collaboration quality
  - P3: polish/consistency

## Output format (required)

```text
PROFILE_GOVERNANCE_REPORT
mode: <profile-audit|profile-remediate|profile-weekly-check>
scope: <repo|org>
visibility: <public|private>
policy_profile: <strict|standard|light>

---
*Full skill: `skills/repo-profile-governance/SKILL.md` in devenv-ops.*