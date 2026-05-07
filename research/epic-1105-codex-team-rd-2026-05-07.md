# Codex Team R&D Planning for Epic #1103

Issue: #1105
Epic: #1103
Date: 2026-05-07
Team: Codex Team
Model: codex:gpt-5@openai
Human: curtisfranks

## Purpose

Produce the Codex Team independent planning pass for Epic #1103: harden the
Megingjord harness so the nine goals remain canonical, enforced, observable,
and compatible across Codex, Copilot, Claude Code, Cursor, and future VS Code
agent runtimes.

## Contamination Declaration

Other-team outputs were viewed before this independent pass began. Viewed:

- #1105 issue body and comment thread via GitHub CLI, including Copilot Team
  and Claude Code Team baton comments and summarized findings.
- #1103 issue body/comments, including a Claude Code Team scope-critique
  summary comment.
- #1024 and #1060 issue details during a prior Epic #1103 importance review.
- #1104 duplicate issue details and Epic #1103 cleanup comments during duplicate
  remediation.
- File names only from `git status`: `research/epic-1105-claude-code-team-rd-2026-05-07.md`
  and `research/epic-1105-copilot-planning-package-2026-05-07.md`.

Controls applied: this artifact is based on a fresh source inventory in a
Codex-only worktree. The other teams' research files were not opened, read, or
copied. Issue-thread exposure is recorded here and not used as source evidence.

## Source Inventory

| Surface | Evidence | Codex finding |
| --- | --- | --- |
| Canonical goal file | `instructions/harness-goals.instructions.md:8` | Full G1-G9 chain and definitions exist. |
| Copilot global prompt | `.github/copilot-instructions.md:92` | Mirrors the chain without G labels. |
| Codex runtime source | `.codex/AGENTS.md:9` | Mirrors the chain without G labels. |
| Repo root agent prompt | `AGENTS.md:5`, `AGENTS.md:44` | Requires Copilot instructions and HAMR, but not the explicit goal chain. |
| Global standards | `instructions/global-standards.instructions.md:34` | Mirrors canonical G-labelled chain. |
| Goal lens hook | `hooks/scripts/goal_lens.py:8` | Injects canonical G-labelled chain on decision prompts. |
| Session context hook | `hooks/scripts/session_context.py:72` | Injects compact chain with `ZeroCost` spelling. |
| Wiki concept | `wiki/concepts/harness-goals.md:17` | Human-readable ordered goal concept exists. |
| Task router | `instructions/global-task-router.instructions.md:3` | Describes local fleet as "second-highest priority goal." |
| HAMR contract | `instructions/hamr-routing.instructions.md:29` | Cross-team provider call contract is runtime-neutral. |
| Worktree governance | `instructions/sandbox-worktree-governance.instructions.md:15` | Requires per-agent worktree start discipline. |
| Team signing | `instructions/team-model-signing.instructions.md:9` | Requires Team&Model signing on governed artifacts. |

## Enforcement Inventory

| Goal area | Existing enforcement/evidence surfaces |
| --- | --- |
| G1 Governance | `hooks/scripts/pretool_guard.py`, `hooks/scripts/stop_checks.py`, `scripts/global/governance-audit.js`, `.github/workflows/baton-gates.yml`, `.github/workflows/label-lint.yml`. |
| G2 Quality | `.github/workflows/quality-gates.yml`, `npm run lint:*`, Playwright tests, `scripts/global/cascade-dispatch.js` quality gate. |
| G3 Zero Cost | `instructions/global-task-router.instructions.md`, `scripts/global/model-routing-engine.js`, `scripts/global/cache-hit-gate.js`, HAMR sticky/cache/spillover scripts. |
| G4 Privacy | `.github/workflows/detect-secrets.yml`, HAMR telemetry redaction policy, `.env` exclusion patterns. |
| G5 Portability | `scripts/global/fleet-config.js`, `scripts/global/fleet-discover.sh`, `skills/fleet-portable-config/SKILL.md`. |
| G6 Resilience | `scripts/global/substrate-health.js`, cascade fallback logic, routing rollback policy. |
| G7 Throughput | workflow concurrency, router smoke checks, telemetry latency fields, cascade no-regenerate rule. |
| G8 Observability | `scripts/global/emit-event.js`, `.dashboard/events.jsonl`, governance audit JSON, substrate health JSON. |
| G9 Interoperability | `.codex/AGENTS.md`, `.github/copilot-instructions.md`, HAMR team config paths, Team&Model signing. |

## Conflict Matrix

| ID | Conflict | Risk | Proposed resolution |
| --- | --- | --- | --- |
| C1 | Goal chain appears in G-labelled, plain, and compact spellings. | Medium | Declare `instructions/harness-goals.instructions.md` canonical and generate or lint mirrors. |
| C2 | Repo root `AGENTS.md` does not itself include the explicit G1-G9 chain. | Medium | Add a short canonical pointer or generated mirror for Codex-compatible startup context. |
| C3 | `global-task-router` says local fleet is the "second-highest priority goal." | High | Reword to "highest zero-cost execution lane after free/auto, subject to Governance and Quality." |
| C4 | Wiki "always-loaded surfaces" can be read as universal across all runtimes. | Medium | Split always-loaded claims by runtime: Copilot instructions, Codex AGENTS, hooks, and wiki. |
| C5 | Session context uses `ZeroCost`, unlike canonical `Zero Cost`. | Low | Normalize injected text or document compact spelling as display-only. |
| C6 | Goal enforcement is distributed across hooks, workflows, scripts, and wiki. | Medium | Add one evidence matrix that maps each goal to enforcement, telemetry, and closeout proof. |
| C7 | Visual QA gates can over-trigger on non-UI planning/docs work. | Medium | Preserve visual QA, but add explicit non-UI N/A evidence classification. |
| C8 | Runtime compatibility depends on deployed assets matching repo source. | High | Require `sync:codex`, `sync:claude`, and `hamr:sync-verify` evidence in implementation rollout. |

## Canonical Proposal

Create one canonical, machine-readable goal constitution contract:

1. `instructions/harness-goals.instructions.md` remains the human canonical file.
2. A generated JSON contract stores ordered IDs, names, definitions, and display text.
3. Mirrors in AGENTS, Copilot instructions, hooks, wiki, and runtime prompts are generated
   or linted against the contract.
4. Every role closeout includes a compact G1-G9 evaluation block only when work changes
   governance, routing, runtime behavior, provider calls, privacy, observability, or UI.
5. Lower-priority overrides require explicit rationale in the issue or PR evidence.

## Rollout Sequence

| Step | Owner role | Planning output |
| --- | --- | --- |
| 1 | Manager | Define acceptance gates for canonical goal contract, runtime mirrors, and evidence matrix. |
| 2 | Collaborator | Inventory all goal-bearing strings and classify as canonical, mirror, vocabulary-only, or stale. |
| 3 | Collaborator | Build lint/generation plan for mirrors without changing runtime behavior first. |
| 4 | Collaborator | Draft conflict-remediation patches for C1-C8 as separate implementation tickets. |
| 5 | Admin | Validate with docs lint, governance audit, HAMR sync verification, and runtime-specific dry runs. |
| 6 | Consultant | Score the rollout against all nine goals and require cross-team synthesis before closure. |

No child implementation tickets were created in this phase.

## Nine-Goal Planning Rating

| Goal | Rating | Rationale |
| --- | --- | --- |
| G1 Governance | 9/10 | Ticket, branch, baton, contamination record, and Team&Model signing are explicit. |
| G2 Quality | 8/10 | Source-derived inventory is broad; implementation proof is deferred by design. |
| G3 Zero Cost | 9/10 | No paid-provider calls or web research were used. |
| G4 Privacy | 9/10 | No secrets or local runtime credentials were opened; `.env` was untouched. |
| G5 Portability | 8/10 | Proposal targets generated runtime-neutral mirrors. |
| G6 Resilience | 8/10 | Rollout includes fallback/sync verification, but failover tests remain future work. |
| G7 Throughput | 7/10 | Planning favors lint/generation automation; no throughput benchmark yet. |
| G8 Observability | 8/10 | Evidence matrix is proposed; telemetry proof remains implementation scope. |
| G9 Interoperability | 9/10 | Codex, Copilot, Claude Code, Cursor, and future VS Code agents are in scope. |

## Team&Model Signature

AI-Signature: Cora Harper
AI-Team-Model: codex:gpt-5@openai
AI-Role: collaborator
Human: curtisfranks
