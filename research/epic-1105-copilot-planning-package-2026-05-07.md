# Epic #1105 — Copilot R&D Planning Package

**Date**: 2026-05-07
**Last updated**: 2026-05-07T21:45Z
**Scope**: Copilot Team first-pass planning package for Epic #1103

| Area | Finding | Decision |
|---|---|---|
| Canonical source | Already exists in `instructions/harness-goals.instructions.md` | Treat as source of truth |
| Goal drift | Goal order is aligned; workflow/governance surfaces drift more than goal text | Prioritize governance-surface cleanup |
| New value | Missing aggregated `G1..G9` enforcement/evidence map | Ship map first after sign-off |
| Risk | Duplicate or parallel edits could re-introduce drift | Sequence changes from canonical outward |

## Goal-Surface Inventory

| Surface | Role in goal model | Notes |
|---|---|---|
| `instructions/harness-goals.instructions.md` | Canonical constitution | Priority order, definitions, decision lens |
| `wiki/concepts/harness-goals.md` | Human-readable concept | Mirrors canon and lists sources |
| `instructions/global-standards.instructions.md` | Always-loaded policy reference | Repeats goal order for governed work |
| `.github/copilot-instructions.md` | Copilot runtime reference | States constitution priority explicitly |
| `.codex/AGENTS.md` | Codex runtime reference | Carries ordered goal sentence |
| `hooks/scripts/goal_lens.py` | Runtime lens injector | Enforces goal-order prompting |
| `hooks/scripts/session_context.py` | Session governance anchor | Injects baton + goal-order context |
| `wiki/index.md` and `wiki/log.md` | Discoverability + history | Provide traceability, not canon |

## Conflict Matrix

| Surface | Severity | Conflict | Remediation path |
|---|---|---|---|
| `instructions/role-baton-routing.instructions.md` | High | Uses older baton model (`backlog/todo`, exact-one-role, old board name) | Reconcile to current ticket taxonomy and board naming in one child ticket |
| `docs/howto/baton-workflow.md` | Medium | `docs/research` lane defaults to reduced baton, but `#1105` is client-directed full baton | Preserve doc default; use explicit per-ticket manager override |
| Epic `#1103` scope vs shipped state | Medium | Epic wording implies more greenfield work than remains | Record that `C1/D1` map work is the main unmet value |
| Goal-bearing docs overall | Low | Minor phrasing drift may remain in definitions/references | Sweep after canonical cross-reference plan is approved |

## Canonical Source Proposal

```text
instructions/harness-goals.instructions.md
  ↓ referenced by always-loaded instruction surfaces
wiki/concepts/harness-goals.md
  ↓ explains and traces the canon
governance/runtime surfaces
  ↓ point back to canon instead of rephrasing it
docs/wiki indexes and changelog
```

- Keep `instructions/harness-goals.instructions.md` as the only normative source.
- Allow derivative summaries in wiki/runtime docs, but require explicit pointer-back language.
- Do not create a second canonical file for the `G1..G9` map; attach the map to canon or a canon-adjacent concept page.

## `G1..G9` Enforcement + Evidence Seed Map

| Goal | Enforcement seed | Evidence seed |
|---|---|---|
| G1 Governance | `.github/workflows/label-lint.yml`, `.github/workflows/baton-gates.yml` | Issue handoff comments, `npm run governance:audit` |
| G2 Quality | `.github/workflows/quality-gates.yml`, `docs-lint.yml` | Playwright/test reports, lint output |
| G3 Zero Cost | `instructions/global-task-router.instructions.md`, `instructions/hamr-routing.instructions.md` | `scripts/global/cost-telemetry.js`, quota/cache signals |
| G4 Privacy | `.github/workflows/detect-secrets.yml`, `.secrets.baseline` | Secret scan runs, token-separation evidence |
| G5 Portability | `scripts/global/fleet-config.js`, `inventory/devices.example.json` | Fleet portability walkthroughs, config diff evidence |
| G6 Resilience | `tests/fleet-graceful-degrade.spec.js`, fallback routing scripts | Degrade-test results, spillover/fallback logs |
| G7 Throughput | latency-aware routing and cache controls | Routing metrics, CI timing and cache stats |
| G8 Observability | `scripts/global/governance-audit.js`, `scripts/global/worktree-governance-audit.js` | Audit JSON, wiki log, workflow checks |
| G9 Interoperability | cross-runtime instruction surfaces and adapter contracts | Cross-team runtime parity checks, E2E suites |

## Sequenced Post-R&D Rollout

| Step | Deliverable | Gate |
|---|---|---|
| 1 | Approve this planning package in `#1105` | Client + Manager confirm sequence |
| 2 | Create one child ticket for workflow-surface reconciliation | Conflict matrix accepted |
| 3 | Create one child ticket for canonical `G1..G9` enforcement/evidence map | Canonical source strategy accepted |
| 4 | Create one child ticket for doc/wiki cross-reference cleanup | Map artifact approved |
| 5 | Validate with governance/lint/doc checks and close Epic child work | Evidence block complete |

## Actionable Next Steps

1. Use `#1105` as the multi-team planning baton and preserve all team findings there.
2. Ask the next team to challenge the conflict matrix, not to re-inventory from zero.
3. Require any later team proposing new goal text to justify why the canonical file is insufficient.
4. Keep implementation children blocked until the client approves the rollout sequence.
5. Treat `instructions/role-baton-routing.instructions.md` as the highest-priority drift surface.