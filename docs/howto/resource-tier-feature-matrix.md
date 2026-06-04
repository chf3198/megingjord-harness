# Resource-Tier Feature Matrix

Per Epic #2398 AC4/AC5/AC7. Maps each major harness feature to the resource tier
it requires and the fallback it takes when that tier is absent (G5) or unreachable
(G6). Tier definitions: `instructions/resource-tier-portability.instructions.md`.

## Feature × tier × fallback

| Feature | Min tier | Fallback when tier absent/unreachable |
|---|---|---|
| Ticket-IS-the-baton (Issues, labels, baton artifacts) | 1 | none needed — Tier-1 is the baseline |
| Lint / lane routing / goal-lens / signing | 0 | none needed — pure local |
| Cross-team mailbox (`mailbox-client.js`) | 2 | `.gnap/messages/<team>/*.json` on the issue branch (#2400) |
| HAMR cache-stats + substrate-health push | 2 | local JSONL (`~/.megingjord/cache-stats.jsonl`); `/quota` marks stale |
| Governance-bundle push (fleet consultant parity) | 2 | local consultant tools; bundle skipped |
| MCP capability dispatch | 2 | `gh` CLI fallback (`MEGINGJORD_MCP_DISABLED=1`) |
| Fleet model dispatch / red-team review | 3 | **tier-gated** — cascades to free-cloud→paid (both Tier 4), but no Tier-1 fallback exists (LLM inference needs ≥Tier-3/4); operator-visible advisory at tier ≤2 |
| Fleet decision oracle | 3 | Tier-1: escalate the decision to operator/client judgement (no LLM needed) |
| Paid LLM provider calls (premium lane) | 4 | **tier-gated** — cascade to fleet (Tier 3)→free-cloud (Tier 4); no Tier-1 fallback (inference requires some provider) |
| Enterprise managed-agent platforms | 5 | **tier-gated** — feature disabled; operator-visible degradation advisory |

Per AC5, every tier≥2 feature either ships a **Tier-1-or-lower fallback** (mailbox,
cache/health, governance-bundle, MCP, fleet oracle) **OR** is explicitly **tier-gated
with an operator-visible degradation message** (LLM-inference features and enterprise
services). LLM inference is inherently tier-gated ≥3 — there is no Tier-1 way to run a
model; those features degrade to an advisory rather than silently failing. None is a
silent single-tier dependency.

## Escape-hatch audit (AC7)

| Env var | Gates tier | Behavior when set |
|---|---|---|
| `MEGINGJORD_HAMR_DISABLED=1` | 2 | disables HAMR mailbox + cron + cache push; local fallbacks used |
| `MEGINGJORD_MCP_DISABLED=1` | 2 | MCP dispatch off; `gh` CLI fallback |
| `MEGINGJORD_FLEET_DIRECT_BLOCK=1` | 3 | enforces fleet-only routing (no direct provider bypass) |
| `MEGINGJORD_MODEL_REVIEW_DISABLED=1` | 3/4 | skips model-diversity review step (advisory) |
| `MEGINGJORD_MULTI_JUDGE_DISABLED=1` | 3/4 | single-judge instead of multi-judge panel |
| `MEGINGJORD_REBASE_DISCIPLINE_DISABLED=1` | 1 | relaxes rebase-discipline gate (workflow, not resource) |
| `MEGINGJORD_MINIMUM_TIER=<0-5>` | — | asserts operator ceiling; features above it must fall back (enforcement: Epic #2398 follow-on `tier-assert.js`) |

**Consistency finding (AC7):** the disable-vars are tier-scoped and consistent —
each gates a Tier-2/3 surface and has a documented fallback. `REBASE_DISCIPLINE`
is a workflow gate, not a resource tier, and is retained as-is. `MINIMUM_TIER` is
the umbrella assertion the per-feature vars compose under; no consolidation needed
beyond adding `MINIMUM_TIER` as the single operator-facing ceiling.

## References

- `instructions/resource-tier-portability.instructions.md` — Tier 0–5 taxonomy.
- `instructions/harness-goals.instructions.md` — G5 contract + tier-graceful pattern.
- `research/resource-tier-taxonomy-audit-2026-05-30.md` — Phase-0 #2412 audit.
- #2400 tier-graceful degradation · #2619 free-cloud failover · Epic #2398.
