---
title: AC-R2 admin-role auto-rotation across cross-team R&D runs
date: 2026-05-29
lane: docs-research
source_tickets: [1112, 2394, 2397]
seed_attribution: qwen2.5-coder:7b draft via 36gbwinresource; refined by Orla Harper
signers:
  manager: Orla Mason (claude-code:opus-4-7@local)
  collaborator: Orla Harper (claude-code:opus-4-7@local)
  consultant: Orla Vale (claude-code:opus-4-7@local)
---

# Phase-0 AC-R2 — Admin-role auto-rotation

Companion to umbrella synthesis #2397. Focused on the structural-advantage question that #2397 §5.2 deferred.

## 1. Empirical baseline from #1105

Synthesis-1105 (2026-05-08) ran with Claude Code Team as admin every wave. Audit signals:
- Decision-ID allocation: admin allocated 11 D-IDs in order of submission; no observable bias toward CC's own proposals
- WAVE_SUMMARY framing: admin summaries cited per-team contributions evenly; no systematic preference observed
- Closeout rubric: CC's positions scored 8/10 average; CP scored 8/10; CX scored 7.5/10. The 0.5-gap on CX is small enough to attribute to model variance, not admin bias

Conclusion: in the 3-team #1105 run, admin-being-CC produced no observable structural advantage for CC. BUT: this is a single data point. Rotation matters more for trust + fairness than for measured outcomes.

## 2. Three rotation models

| Model | Description | Determinism |
|---|---|---|
| **Round-robin by ticket-N mod team-count** | admin team = teams[ticket_number % len(teams)]. With 4 teams: ticket #1112 → admin = teams[0] = Claude Code; ticket #1116 → admin = teams[0] again | Fully deterministic, predictable, simple |
| **Weighted by availability** | admin team = max-availability team at Epic kickoff (heartbeat from broker.js #1088) | Adaptive but operator-opaque |
| **Capability-based** | admin team = team with highest historical rubric on similar Epics (area-weighted) | Optimal but introduces an inscrutable ranking system |

## 3. Trade-off table

| Goal | Round-robin | Availability-weighted | Capability-based |
|---|---|---|---|
| G1 Governance | 10 (no operator intervention; alias derivable per registry) | 7 (heartbeat dependency Tier-2) | 6 (ranking system is policy decision) |
| G5 Portability | 10 (Tier-1) | 7 (Tier-2 broker.js) | 8 (Tier-1 with stored history) |
| G6 Resilience | 9 (always-resolvable) | 6 (heartbeat may not register) | 7 (history may be incomplete) |
| G7 Throughput | 10 (zero overhead) | 8 (broker query) | 7 (ranking compute) |
| G8 Observability | 10 (deterministic from Epic number) | 7 (heartbeat trace) | 8 (rank explanation needed) |
| G9 Interop | 10 (uniform across runtimes) | 8 (broker integration per runtime) | 8 (history available cross-runtime) |
| **mean** | **9.8** | 7.2 | 7.3 |

## 4. Recommendation: Round-robin by ticket-N mod team-count

`admin_team = teams[ticket_number % len(teams)]` is simple, deterministic, Tier-1, and produces structural fairness across many runs without any observability burden. With 4 teams cycling, each team is admin 25% of runs over a sufficiently large window. Operator can override via `--admin-team <name>` per-Epic CLI flag for exceptional cases (e.g., specific team has subject-matter expertise).

Registry-derived alias: for any (rotated_team, role) the canonical alias resolves via `expectedAliasFor({team: rotated_team, model: ..., role: 'manager'/'collaborator'/'admin'/'consultant'})`. Antigravity admin → Apollo Reyes; Copilot admin → Orion Reyes; etc.

## 5. Tier-1 implementation

- Phase-1 AC2 (#2403 scaffolding): `scripts/global/synthesis-init.js` reads `inventory/team-model-signatures.json` for team list, computes admin = teams[N % len] at Epic kickoff
- Phase-1 AC3 (#2404 prompts): admin-team string substituted into MANAGER_HANDOFF template
- Phase-1 AC4 (#2405 snapshot job): GitHub Actions step posts admin signer + cross-team-consult-pickup invitation for non-admin teams

## 6. Open questions for Phase-1

- Tie-break for teams with identical ticket% (e.g., 2 cycles per 8 tickets): use seed offset based on Epic.priority?
- How to handle a team that declines admin duty (capacity / language barrier / etc.)? Override CLI flag exists but should the harness emit a Tier-3 anneal when an Epic ships with non-rotated admin?
- Does the cross-team-consult-pickup skill need an "admin-equivalent" pickup mode for Epics where admin is rotated TO a team that doesn't have one operating today?

Refs Epic #1112 · Refs #2397 umbrella synthesis · Refs #2370 cross-team-response-fidelity · Refs cross-team-consult-pickup skill
