---
title: AC-R3 per-team file model at fanout > 3 teams
date: 2026-05-29
lane: docs-research
source_tickets: [1112, 2395, 2397]
seed_attribution: qwen2.5-coder:7b draft via 36gbwinresource; refined by Orla Harper
signers:
  manager: Orla Mason (claude-code:opus-4-7@local)
  collaborator: Orla Harper (claude-code:opus-4-7@local)
  consultant: Orla Vale (claude-code:opus-4-7@local)
---

# Phase-0 AC-R3 — Per-team append-only file model at fanout > 3 teams

Companion to umbrella synthesis #2397. Focused on the fanout question that #2397 §5.2 deferred.

## 1. Empirical baseline at 4 teams

Cross-orchestrator compatibility suite #2388 confirms 4 teams (claude-code, codex, copilot, antigravity) recognized at all 6 surfaces (signer-registry, runtimeKinds, deploy-target, plugin-manifest, dashboard-vendor, parity-inventory) with 30/30 tests green at HEAD `c9d3dbfb`. The #1105 protocol-v2 scheme (`planning/positions/{cc,cp,cx}.md`) extends naturally to `planning/positions/{cc,cp,cx,ag}.md` for 4 teams. No write contention observed because per-file ownership invariant from protocol-v2 §6 holds at any fanout — each team writes to its own file; admin reads all and writes derived state.

The interesting question is fanout > 4 (e.g., a future 5-10 team scenario).

## 2. Three alternative file models

| Model | Description | Scaling characteristic |
|---|---|---|
| **Current per-team-MD** (status quo) | One markdown per team in `planning/positions/<team>.md`; admin reads all + synthesizes | O(N) files; O(N) admin work; works at any N |
| **SQLite-mailbox** (intermediate) | One SQLite DB at `planning/positions.db` with per-team rows; admin query for synthesis | O(1) files; O(N) admin work; query-able |
| **GNAP-board** (industry-aligned) | `.gnap/positions/<team>/<turn>.json` files committed to issue branch per GNAP RFC | O(N·T) files; O(N·T) admin work; full audit trail |

## 3. Trade-off table

| Goal | per-team-MD | SQLite-mailbox | GNAP-board |
|---|---|---|---|
| G3 Zero Cost | 10 (text files) | 8 (SQLite local) | 9 (text JSON) |
| G5 Portability | 10 (any text editor) | 7 (SQLite tooling needed) | 9 (industry-standard) |
| G6 Resilience | 9 (per-file mutual exclusion) | 7 (DB corruption risk) | 9 (git-versioned) |
| G7 Throughput | 9 (no DB I/O) | 7 (transaction overhead at high concurrency) | 8 (commit overhead per write) |
| G8 Observability | 9 (git log per file) | 6 (DB events not in git) | 10 (full audit trail) |
| G9 Interop | 9 (cross-runtime text) | 7 (requires DB client per runtime) | 10 (industry-standard) |
| G10 Maintainability | 9 (simple) | 7 (schema migrations) | 8 (4 JSON files canonical) |
| **mean** | **9.3** | 7.0 | **9.0** |

## 4. Recommendation

**Stay with current per-team-MD scheme for the productized protocol-v3.** It wins at 9.3 mean vs 9.0 (GNAP-board) and 7.0 (SQLite). The current scheme survives 4-team fanout empirically (#2388 evidence) and extends linearly to 10+ teams without architectural change.

**Optional GNAP-board overlay for industry interop**: if Phase-1 implementation discovers third-party agentic systems wanting to participate via GNAP RFC, ship a `.gnap/positions/*` mirror generated FROM the canonical per-team-MD via a one-line synthesizer in the snapshot job (#2405 AC4). This gives industry interop without abandoning the simpler primary scheme. Tier-1 compatible.

## 5. Tier-1 implementation

- Phase-1 AC1 (#2402 protocol-v3): per-team-MD scheme stays canonical; admin synthesis writes to `planning/decisions.md`
- Phase-1 AC4 (#2405 snapshot job): GitHub Actions schedule reads per-team files + writes derived state to issue
- Optional Phase-1 follow-on: `.gnap/positions/*` overlay for GNAP-RFC interop

No Tier-2 dependency. The scheme is local-first by design.

## 6. Open questions for Phase-1

- At what fanout does per-team-MD admin synthesis become operator-unfeasible? Empirical evidence needed beyond 4-team #2388 baseline.
- Should the GNAP-board overlay be opt-in (per-Epic flag) or opt-out (default-on)?
- File-naming convention at fanout: 2-letter abbreviation (cc, cp, cx, ag) scales to ~24 teams before collisions; consider 3-letter at 10+ teams.

Refs Epic #1112 · Refs #2397 umbrella synthesis · Refs #2388 cross-orchestrator compat suite · Refs #2400 tier-graceful pattern
