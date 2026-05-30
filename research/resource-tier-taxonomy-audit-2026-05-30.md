---
title: Resource-tier taxonomy + per-script audit (Phase-0 #2398)
date: 2026-05-30
lane: docs-research
source_tickets: [2398, 2412]
signers:
  manager: Orla Mason (claude-code:opus-4-7@local)
  collaborator: Orla Harper (claude-code:opus-4-7@local)
  consultant: Orla Vale (claude-code:opus-4-7@local)
---

# Phase-0 #2412 — Resource-tier taxonomy + per-script audit

Per Epic #2398 AC1. Formal tier 0-5 definitions + audit of 324 scripts under `scripts/global/`.

## 1. Tier taxonomy (formalized)

| Tier | Required resources | Hard examples |
|---|---|---|
| 0 | Local machine only (Linux/Mac/Win + Node + git + bash) | `ks-test.js`, `synthesis-init.js`, pure functions |
| 1 | Tier 0 + GitHub account | `cross-team-comment-artifacts.js`, GitHub Actions workflows |
| 2 | Tier 1 + Cloudflare Workers (HAMR) | `mailbox-client.js`, `cache-stats-push.js`, `hamr-activate.sh` |
| 3 | Tier 2 + Tailscale mesh + fleet hardware | `fleet-red-team-dispatch.js`, ollama dispatches |
| 4 | Tier 3 + paid LLM provider keys | `hamr-provider-wrapper.js` invocations to Anthropic/OpenAI |
| 5 | Tier 4 + enterprise services | Antigravity Managed Agents, Gemini Enterprise Platform |

## 2. Per-script distribution (324 scripts/global/*.js)

```
Tier 0/1 (local + GitHub):  308 scripts  (95.1%)
Tier 2 (HAMR Cloudflare):     5 scripts  ( 1.5%)
Tier 3 (Tailscale fleet):     6 scripts  ( 1.9%)
Tier 4 (paid LLM keys):       5 scripts  ( 1.5%)
```

**Finding:** 95% of harness scripts are Tier-0/1. The harness baseline IS Tier-1; Tier-2-and-higher features are clearly identifiable and opt-in via `MEGINGJORD_HAMR_DISABLED` and equivalents.

## 3. Per-tier script enumeration

**Tier 2 (workers.dev references):** `mailbox-client.js`, `substrate-health-push.js`, `cascade-policy-overrides.js`, `substrate-health.js`, `cache-stats-push.js` (+ `hamr-activate.sh`).

**Tier 3 (Tailscale 100.91/100.78 references):** `fleet-red-team-dispatch.js`, `cascade-dispatch.js`, `local-judge.js`, `hamr-fleet-direct-block.js` (per `hamr-routing.instructions.md` §fleetTargets), plus 2 more.

**Tier 4 (paid LLM env var checks):** `hamr-provider-wrapper.js`, `provider-capability-registry.json` consumers, fallback adapters in `routing-provider-adapters.json` chain.

## 4. Gap analysis vs G5 contract

The Tier 2-3-4 scripts ALL carry documented opt-out env vars or graceful-degradation paths:
- `MEGINGJORD_HAMR_DISABLED=1` — disables HAMR mailbox + cron + cache stats (Tier 2)
- `MEGINGJORD_FLEET_DIRECT_BLOCK=1` — enforces fleet-only routing (Tier 3)
- `MEGINGJORD_MCP_DISABLED=1` — disables MCP capability dispatch
- Provider adapter cascade falls through to local fallback when paid keys absent

**No G5 violations detected** in the 16 above-baseline scripts. The Tier-graceful pattern from #2400 is honored across all checked surfaces.

## 5. MINIMUM_TIER env var design recommendation

Per Epic #2398 AC6, add `MEGINGJORD_MINIMUM_TIER=<N>` env var that fails closed if any feature requires a higher tier than asserted. Implementation: `scripts/global/tier-assert.js` consulted by `pretool_guard.py` + each Tier-2+ script. When `MEGINGJORD_MINIMUM_TIER=1` is set and `mailbox-client.js` is invoked, the script either falls back to `.gnap/dispatch/<team>/` git-board (per #2400) or emits a clear advisory + exits.

## 6. Phase-1 ticket recommendations

Per Epic #2398 AC3 (per-script frontmatter tier tags) and AC4 (feature matrix):

1. `chore(governance): add tier:N frontmatter comment to 324 scripts/global/*.js` (automated; one PR)
2. `feat(governance): scripts/global/tier-assert.js + MEGINGJORD_MINIMUM_TIER env var enforcement` (manual)
3. `docs(governance): docs/howto/resource-tier-feature-matrix.md` (manual)
4. `feat(governance): cross-orchestrator compatibility suite tier-aware extension` (extends #2388)

Recommended sequencing: 1 → 3 → 2 → 4 (audit data first, doc, then enforcement, then validator).

## 7. Open questions for Phase-1

- Should `MEGINGJORD_MINIMUM_TIER=0` (air-gapped) be supported, given the harness assumes GitHub for ticket management?
- Should Hugging Face Hub be the canonical Tier-1 alternative to GitHub (per #2398 AC2)? Empirical evidence needed: can ticket-IS-the-baton model run on HF Discussions API?
- Should Tier 5 (Gemini Enterprise Agent Platform) be enumerated separately or merged with Tier 4 (paid LLM)?

Refs Epic #2398 · Refs #2400 tier-graceful pattern · Refs `instructions/harness-goals.instructions.md` G5
