---
title: "Ticket audit pass — 2026-05-02 Manager-authority sweep"
type: research
created: 2026-05-02
status: pending
tags: [governance, audit, manager-authority, free-fleet, ticket-hygiene]
---

# Ticket audit pass — 2026-05-02

Manager-authority sweep across 18 open tickets in `chf3198/megingjord-harness`. Token-minimal pattern: deterministic governance scripts establish ground truth; LLM-grounded review (Groq llama-3.3-70b + Cerebras qwen-3-235b, free fleet) suggests follow-up actions; aggregator emits a 1-line summary so Claude Code only consumes ~10 KB tokens for the entire pass.

## Methodology

1. `npm run governance:drift|verify|reconcile` — deterministic ground truth. Result: **0 violations across all 18 open tickets**.
2. Per-ticket LLM review with binding context (`ticket-driven-work`, `role-baton-routing`, `epic-governance`).
3. Aggregation to `/tmp/ticket-audit.json`.
4. Manager-only remediation via `gh` CLI (labels, comments, ticket creation). No code, no PRs.

## Findings

### Real

- **#836 (new) — documentation governance drift.** `epic-governance.md` says "Epic always carries `role:manager`" while `ticket-driven-work.md` says "`status:backlog` forbids any `role:*`". The deterministic classifier resolves in favor of the backlog rule (zero violations). Documentation must reconcile.
- **#732 / #766 / #833 cluster.** Potential overlap with the closed `#734` / `#765` and the open `#726`. Boundary comments posted on each ticket asking for explicit linkage or de-duplication before pickup.
- **#829 AC tightening.** Original "no false positives blocking active development" is subjective. Replaced with two objective gates (audited baseline + green pre-commit run).

### False positives (LLM noise, dismissed)

- LLM repeatedly flagged "missing role:manager on epic" for `status:backlog` epics. Deterministic checker disagrees; instruction-rule contradiction is documented in #836.
- LLM flagged #829 (a `type:task`, not epic) as "epic-related work missing role:manager" — pure category error.

## Productization

`#837` opens a follow-up to move the audit script from `/tmp` (current scratch) into `scripts/global/governance-audit.js` as `npm run governance:audit`, with weekly CI workflow.

## Token cost evidence

- Claude Code: ~8 KB total (script invocation + 1-line summary + Manager actions).
- Free fleet/cloud (Groq + Cerebras): ~80 KB across 18 dispatches.
- 0 paid LLM tokens.

## Sources

- `instructions/ticket-driven-work.instructions.md` (binding rule set)
- `instructions/epic-governance.instructions.md` (binding rule set)
- `instructions/role-baton-routing.instructions.md` (binding rule set)
- `scripts/global/governance-drift-classifier.js` (deterministic ground truth)
- `/tmp/ticket-audit.json` (full per-ticket verdicts)

Refs #836, #837, #732, #766, #829, #833
