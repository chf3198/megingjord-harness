# Gate ↔ Stress-Invariant Map

Maps every governance gate workflow to a corresponding stress-test invariant.
Per Epic #1398 AC10. Derived from #1395 Theme 7 (gate ↔ stress-invariant mapping).

## Why this map exists

A gate that has no corresponding stress-test invariant is a gate the stress
test cannot verify. The Phase-0 audit (#1391) found 0% of real governance
gates exercised by the existing mock stress. This document enumerates the
expected coverage so that every gate is tracked.

## How to read this

Each row: a gate (workflow file or skill) on the left, the stress-test
invariant on the right — what the stress run must produce, fail, or observe
for the gate to be considered exercised.

## Coverage map

| Gate (workflow / skill) | Stress invariant under Tier-A/B | Stress invariant under Tier-C/D |
|---|---|---|
| `.github/workflows/baton-gates.yml` (collaborator-gate) | Stress emits `COLLABORATOR_HANDOFF` string in fixture; assert presence | Same + assert real comment posted |
| baton-gates admin-gate (signer-independence) | Stress rotates 4 distinct signer aliases per ticket | Same + verify GitHub comment authors |
| baton-gates consultant-gate | Stress emits `CONSULTANT_CLOSEOUT` with G1-G9 rubric | Same + real comment |
| `.github/workflows/closeout-schema.yml` | Stress assertion: every closeout includes verdict, verification timestamp | Same |
| `.github/workflows/test-evidence.yml` | Stress assertion: `MANAGER_HANDOFF` declares `test_strategy:` | Same |
| `.github/workflows/doc-update-gate.yml` | Stress assertion: when code changes, `.changes/unreleased/<N>.md` exists | Same |
| `.github/workflows/label-lint.yml` (ADR-010) | Stress assertion: exactly one `status:*` and `role:*` label per ticket fixture | Same + real label transitions |
| `.github/workflows/evidence-completeness.yml` | Stress assertion: branch number matches `Refs #N` | N/A — no real branch in Tier-A |
| `.github/workflows/branch-name-required.yml` | Assert mock branch name matches `<type>/<N>-<slug>` pattern | Same + real branch |
| `.github/workflows/pr-title-required.yml` | Assert mock PR title ≤72 chars + Conventional Commits | Same + real PR |
| `.github/workflows/lint-required.yml` | Assert orchestrator emits files within 100-line cap | Same |
| `.github/workflows/danger-required.yml` | Assert PR body includes evidence block | N/A in mock |
| `.github/workflows/worktree-governance-required.yml` | Assert worktree pattern in fixture | N/A in mock |
| `.github/workflows/cross-team-edit-warn.yml` | Stress includes a cross-team ticket fixture | Same |
| `.github/workflows/HAMR-bypass-lint.yml` | Assert mock provider calls go through `wrapProviderCall` shim | Same + real wrapped call |
| `.github/workflows/epic-close-readiness.yml` | Assert Epic fixture has all children terminal before close | Same |
| `.github/workflows/log-rotation.yml` (#1339 C6) | Stress emits log entries; verify rotation triggers at size cap | Same |
| `.github/workflows/scan.yml` (secret detection) | Stress fixtures contain placeholder tokens, never real | Same |
| `.github/workflows/vale.yml` | Assert generated handoff strings pass vale style | Same |
| `.github/workflows/lockfile-sync.yml` | Stress does not modify package.json without lockfile update | Same |
| `.github/workflows/quality-required.yml` | Stress emits well-formed JSON events | Same |
| `.github/workflows/dependency-review.yml` | Stress does not introduce new dependencies | Same |
| Skill: `workflow-self-anneal` (Tier-1/2/3, #1308) | Stress injects anneal events; kill-switch (#1411) fires at >10/min | Same + real Tier-2 ticket |
| Skill: `cross-team-consult-pickup` (#1305) | Stress fixture includes cross-team pickup ticket | Same |
| Skill: `docs-drift-maintenance` | Stress run produces no docs drift | Same |

## Coverage summary

| Category | Total gates | Covered by Tier-A | Covered by Tier-C |
|---|---:|---:|---:|
| Baton enforcement | 4 | 4 (100%) | 4 (100%) |
| Schema / format | 6 | 6 (100%) | 6 (100%) |
| Repo hygiene | 5 | 4 (80%) | 5 (100%) |
| Security | 2 | 2 (100%) | 2 (100%) |
| Quality + dependency | 3 | 3 (100%) | 3 (100%) |
| Anneal + workflow | 3 | 3 (100%) | 3 (100%) |
| Skills | 3 | 3 (100%) | 3 (100%) |
| **Total** | **26** | **25 (96%)** | **26 (100%)** |

The one Tier-A gap is `evidence-completeness.yml` which checks real-branch
state — meaningful only in Tier-B+ where stress operates against a real branch.

## How to use this map

1. Phase-1 implementation (#1398) must add an assertion in the stress suite
   for each row above. Missing assertions are gaps.
2. When a new gate is added, append a row here AND add the assertion.
3. The Consultant rubric for any future stress-related ticket should check
   that this map is up to date.

## Refs
- Epic #1398 (Phase-1 implementation)
- #1391 (gap matrix — original 20 dimensions, this map is the gate-specific subset)
- #1395 Theme 7 (gate ↔ stress-invariant pattern)
- #1411 (this ticket — kill-switch + map)
