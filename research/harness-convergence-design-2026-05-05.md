---
title: Megingjord Harness Convergence Design v1
date: 2026-05-05
epic: 922
authored-by: operator-deputy (Claude Code Team runtime, single-LLM fast-track per operator authorization)
status: APPROVED via 3 consecutive SIGN_OFFs (Codex/Copilot/Claude Code) at rounds 7/8/9 of #922
---

# Megingjord Harness Convergence Design v1

## Purpose

Map the four canonical harness axes (governance, tooling, fleet, HAMR)
to a single architecture with explicit team-ownership cuts and
explicit cross-axis wiring. Eliminates incidental coupling and
documents the integration contracts each team consumes.

## Convergence summary (canonical, verbatim across all 3 SIGN_OFFs)

1. The harness has 4 axes: governance / tooling / fleet / HAMR.
2. The Dashboard is the observation/control plane over the 4 axes (NOT a 5th axis).
3. HAMR is shared substrate; Claude Code Team is primary maintainer; cross-team consumers integrate via the `hamr-provider-wrapper` contract.
4. `substrate-health` gates `model-routing-engine` UPSTREAM of `cascade-dispatch` via `cascade-policy-overrides.json` (HAMR-produced, model-routing-engine-consumed).
5. Per-team config markers (`~/.claude`, `~/.copilot`, `~/.codex/devenv-ops/hamr-config.json`) carry an `axis_consumers` declaration.
6. `SKILL.md` frontmatter is the canonical tool-discovery format; `.codex/AGENTS.md` sections and `.github/copilot-instructions.md` sections auto-derive via Codex-Team-owned derive script (read-only on `SKILL.md` per D4.1).
7. Cross-team edit protocol on shared files (`instructions/`, `inventory/`, `wiki/`) flows through the existing baton handoff; governance-lint will warn when a PR edits cross-cut files without citing a coordinating ticket.
8. `megingjord-coord` deprecation in favor of HAMR mailbox (#918) is deferred to a separate Epic.
9. Dashboard HAMR opt-in (#966) is downstream of this convergence; it consumes the toggle-state contract this design specifies.

## Architecture diagram

```
                  ┌────────────────────────────────────────┐
                  │            OPERATOR (chf3198)          │
                  └────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
     [Codex Team]            [Copilot Team]          [Claude Code Team]
     codex-cli               copilot                 claude-code-cli
     ~/.codex/devenv-ops/    ~/.copilot/             ~/.claude/
          │                       │                       │
          ▼                       ▼                       ▼
   hamr-config.json        hamr-config.json        hamr-config.json
   (axis_consumers)        (axis_consumers)        (axis_consumers)
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                                  ▼
            ┌────────────────────────────────────────────┐
            │     SHARED FOUR-AXIS HARNESS SUBSTRATE     │
            │                                            │
            │  Governance (Codex Team maintainer)        │
            │  Tooling (canonical: SKILL.md frontmatter) │
            │  Fleet (substrate-health → overrides       │
            │         → model-routing-engine            │
            │         → cascade-dispatch)               │
            │  HAMR (Claude Code Team maintainer;        │
            │        shared substrate)                   │
            └────────────────────────────────────────────┘
                                  │
                                  ▼
              ┌──────────────────────────────────┐
              │  Dashboard (observation/control) │
              │  reads all 4 axes;               │
              │  writes back via signed APIs.    │
              └──────────────────────────────────┘
```

## Team-ownership matrix

| Surface | Owner | Consumers |
|---|---|---|
| `dashboard/*`, `dashboard/js/token-reconcile.js`, `cost-report.js`, `model-routing-engine.js` | Copilot Team | All teams (read) |
| `cloudflare/hamr/*`, `scripts/global/hamr-*`, HAMR Worker routes | Claude Code Team | All teams |
| `.github/workflows/label-lint.yml`, ADRs, `.codex/AGENTS.md` | Codex Team | All teams |
| `instructions/`, `inventory/`, `wiki/` | Shared (multi-author) | All teams; cross-team edits via baton |
| `skills/*`, `SKILL.md` files | Skill author | All teams via deploy |

## Cross-axis wiring contracts

### substrate-health → model-routing-engine

```
HAMR Worker (every 6h cron)
   ↓ writes
`cache-stats:hit-rate-7d` + `substrate-health:latest` to KV
   ↓ producer (npm run hamr:periodic-push)
`scripts/global/cascade-policy-overrides.js` (NEW Wave 8 child)
   ↓ writes
`~/.megingjord/cascade-policy-overrides.json`
   ↓ read by
`scripts/global/model-routing-engine.js` (Copilot surface;
   1-line additive read on startup; falls back if absent)
   ↓ consumed by
`scripts/global/cascade-dispatch.js` (unchanged)
```

### hamr-provider-wrapper integration contract

The wrapper guarantees:
- Pre-call: merges `cacheHeaders(provider)` into request hints.
- Post-call: emits `appendCacheStat` with `cache_read_tokens` from the provider adapter.
- On rate-limit: returns `maybeSpillover` decision.
- Tier-aware: `pickStickyProvider` selection when `tier` provided.
- Honors `MEGINGJORD_HAMR_DISABLED=1` env override.
- Honors per-team `~/.<team>/hamr-config.json` `enabled: false`.

The wrapper requires:
- Caller passes `provider` name from `['anthropic', 'openai', 'gemini', 'groq', 'cerebras', 'openrouter']`.
- Caller's `callFn` accepts `(hints)` and merges `hints.headers` + `hints.bodyExtras` into request.

### SKILL.md frontmatter canonical → derived per-team views

```
SKILL.md frontmatter (single source of truth)
   ↓
Codex Team derive script (NEW Wave 8 child; read-only on SKILL.md)
   ├→ writes `.codex/AGENTS.md` skill section
   └→ writes `.github/copilot-instructions.md` skill section
```

Derive script invariants (per Round-4 D4.1 scope cap):
- READ-ONLY on `SKILL.md` files.
- Append/replace named sections in `.codex/AGENTS.md` and `.github/copilot-instructions.md`.
- Idempotent.
- ≤100 lines.

## Cross-team edit protocol on shared files

When a PR modifies `instructions/`, `inventory/`, or `wiki/`:
- PR body MUST cite a coordinating ticket (Epic or sub-issue).
- governance-lint will WARN (not fail) when this is missing — Codex Team scopes the lint rule as a follow-up.
- Reviewer responsibility: confirm the cross-team coordination is real before merging.

## Deferred items (out of scope for v1)

- megingjord-coord deprecation in favor of HAMR mailbox (#918) → separate Epic.
- Dashboard HAMR opt-in (#966) → downstream of this convergence; UX/discovery research already in flight via #967.
- Aperture vs LiteLLM architecture decision (Epic #949) → independent track; consults this design but does not block on it.

## Acceptance criteria for downstream child Epics

Each downstream child Epic spawned from this convergence must:
- [ ] Cite this design (`research/harness-convergence-design-2026-05-05.md`) in its body.
- [ ] Identify which of the 9 numbered convergence items it implements.
- [ ] State the team-ownership cut for the implementation.
- [ ] Honor the cross-team edit protocol.

## Revision policy

This is `v1`. Revisions land in `v2`, `v3`, etc. files in `research/` and require a new 3-team SIGN_OFF cycle. Inline edits to v1 are forbidden once SIGN_OFFs are recorded.
