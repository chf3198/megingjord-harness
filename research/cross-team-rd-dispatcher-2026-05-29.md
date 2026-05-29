---
title: AC-R1 dispatcher architecture for cross-team R&D synthesis
date: 2026-05-29
lane: docs-research
source_tickets: [1112, 2393, 2397]
seed_attribution: qwen2.5-coder:7b draft via 36gbwinresource; refined by Orla Harper
signers:
  manager: Orla Mason (claude-code:opus-4-7@local)
  collaborator: Orla Harper (claude-code:opus-4-7@local)
  consultant: Orla Vale (claude-code:opus-4-7@local)
  red_team: qwen2.5-coder:7b@36gbwinresource
---

# Phase-0 AC-R1 — Prompt-dispatcher architecture for cross-team R&D synthesis

Companion to umbrella synthesis #2397. Focused on the dispatcher choice that #2397 §5.2 deferred.

## 1. Three candidate architectures

| # | Architecture | One-line description |
|---|---|---|
| 1 | **Operator-driven** | Human (client) pastes prompts into each runtime session. Status quo from #1105. |
| 2 | **Harness-driven via mailbox** | `scripts/global/synthesis-dispatch.js` reads epic-N config + writes per-team kickoff prompts to HAMR R2 mailbox (Tier 2) OR `.gnap/dispatch/<team>/<ts>.json` committed to issue branch (Tier 1 fallback per #2400). Each team's session-start hook reads its own mailbox. |
| 3 | **Hybrid** | Operator-initiated kickoff (substrate = lead team per protocol-v2 §1); subsequent wave-N prompts auto-dispatched via mailbox/git-board; admin snapshot uses GitHub Actions schedule (Tier 1) or HAMR cron (Tier 2). |

## 2. Trade-off table

| Goal | Operator-driven | Mailbox | Hybrid |
|---|---|---|---|
| G3 Zero Cost | 10/10 (no infra) | 7/10 (Tier-2 worker if HAMR; Tier-1 GH Actions free) | 9/10 |
| G5 Portability | 8/10 (works air-gapped except no auto-mailbox) | 5/10 (requires Tier 2 OR Tier-1 fallback) | 8/10 (Tier-1 fallback default per #2400) |
| G6 Resilience | 6/10 (single point of failure: operator) | 8/10 (mailbox is queue; teams pull on session start) | 9/10 |
| G7 Throughput | 4/10 (operator wall-clock latency) | 9/10 (parallel teams pull simultaneously) | 9/10 |
| G8 Observability | 5/10 (no dispatch log) | 9/10 (mailbox is append-only audit) | 9/10 |
| G9 Interop | 7/10 (per-runtime paste pattern differs) | 9/10 (uniform mailbox surface across runtimes) | 9/10 |
| **mean** | 6.7 | 7.8 | **8.8** |

## 3. Recommendation: Hybrid

Lead-team kickoff stays operator-initiated (preserves substrate-derived lead-team selection from protocol-v2 §1). Wave-N prompts and admin snapshots become harness-driven via mailbox (Tier 2 HAMR R2 when available) OR `.gnap/dispatch/<team>/` git-board (Tier 1 fallback). Pattern aligns with #2400 tier-graceful degradation — optimal when available, baseline when not.

Goal-lens: hybrid maximizes G7 throughput + G8 observability without sacrificing G3 cost or G5 portability. Lead-team-kickoff preserves the structural fairness that protocol-v2 §1 already enforces.

## 4. Tier-1 vs Tier-2 implementation sequence

**Tier 1 (Phase-1 AC2 + AC3 deliverables)**:
1. `scripts/global/synthesis-dispatch.js` writes prompts to `.gnap/dispatch/<team>/<ts>.json` committed to the issue branch
2. Per-team session-start hooks (`hooks/scripts/session_context.py` for Claude Code; equivalents per runtime) read the .gnap/dispatch/<team>/ directory on session start
3. Admin snapshot via `.github/workflows/cross-team-rd-snapshot.yml` (Phase-1 AC4)

**Tier 2 (optimization layer; Phase-1 follow-on)**:
1. `mailbox-client.js` already supports `/mailbox/write` + `/mailbox/read`; extend `synthesis-dispatch.js` to prefer mailbox when `MEGINGJORD_HAMR_DISABLED` is unset and the worker is reachable
2. HAMR 6h cron replaces GitHub Actions schedule for sub-6h-precision snapshots

The Tier-2 upgrade is invisible to the operator — `MEGINGJORD_HAMR_DISABLED=1` reverts to Tier-1 transparently per #2400.

## 5. Open questions for Phase-1

- Should the dispatcher detect the operator's lead-team substrate from `inventory/team-model-signatures.json` substrateTeamMap or require explicit `--lead-team` arg?
- For runtimes without a session-start hook (Antigravity CLI? Codex?), how does the team's session "pull" its prompt — operator-action or a session-init wrapper script?
- Should wave-N dispatch wait for prior-wave team-response artifacts (synchronous) or proceed on stability detection (asynchronous; see AC-R4 #2396)?

Refs Epic #1112 · Refs #2397 umbrella synthesis · Refs #2400 tier-graceful pattern
