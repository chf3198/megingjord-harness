# Cross-Team Epic-Creation Standard (design-of-record)

> **Status:** Phase-0 design-of-record for Epic #3255 (research gate #3256). Right-sized per cross-family
> consensus (2026-07-09). This document is the **standard-of-record**; enforcement lives in the canonical
> validators referenced below — this doc does **not** re-specify rules that would drift from them.
>
> **Companion:** [reconciliation table + Phase-1 plan](governance-epic-creation-reconciliation.md).

## 1. Purpose

Give all four teams (Claude Code, Copilot, Codex, Antigravity) **one** way to create a research-first Epic,
so governance does not drift between teams. The value is *cross-team uniformity by default* — an author on any
team gets a compliant Epic without re-reading the rulebook.

## 2. Lineage & scope decision

- **Epic:** #3255 — "Guardrail for optimal ticket & Epic creation across all teams" (research-first).
- **Gate:** #3256 — single blocking R&P ticket (this deliverable).
- **Origin exemplar:** #3251 / #3252 (the over-decomposed Phase-0 anti-pattern that motivated the Epic).
- **Scope decision (right-size):** A pre-work reconciliation (2026-07-09) found the Epic's *detection/enforcement*
  half already shipped after it was filed (see the [reconciliation](governance-epic-creation-reconciliation.md)).
  A free cross-family panel (Mistral 0.95, Meta/Llama 0.90, SambaNova 0.90 — unanimous) resolved the critical
  decision to **right-size**: keep only the un-shipped *creation-by-default* residual. Rebuilding the validators
  was rejected as redundant and drift-inducing.

## 3. The standard — canonical research-first Epic shape

A compliant research-first Epic MUST have, at creation time:

1. **Labels:** `type:epic` + `phase-gate:research-first` + `role:manager` + `status:backlog` + `priority:P*` +
   `area:*`. (Role/status invariants: Epics only ever carry `role:manager`, transiently `role:consultant`
   during `status:review` — canonically defined, do not restate, in
   [`instructions/epic-governance.instructions.md`](../instructions/epic-governance.instructions.md).)
2. **Exactly one blocking R&P child** (the single gate) — NOT multiple reactive research children. This is the
   direct fix for the #3251 over-decomposition anti-pattern.
3. **Just-in-time children:** no implementation/dev child and no development AC authored until the R&P gate
   closes with Consultant rubric `min(G1..G9) ≥ 7` **and** the Manager posts an `EPIC_RESCOPE` comment.
4. **Phase-1 traceability:** every Phase-1 child cites the Phase-0 child it consumes (`Refs #N`).
5. **Re-arm on reopen:** if the Phase-0 child reopens, the gate re-arms and Phase-1 pauses.

Rules 2–5 are **enforced today** by the canonical surface listed in the
[reconciliation](governance-epic-creation-reconciliation.md) — the standard's job is to make an author *land on
this shape by default*, which is the residual.

## 4. Consensus record (zero human intervention, zero paid tokens)

Free-cloud cross-family panel via `scripts/global/free-cloud-dispatch.js` on the right-size-vs-cancel-vs-rebuild
decision:

| Family | Choice | Confidence | residual_is_real |
|---|---|---|---|
| Mistral | A (right-size) | 0.95 | true |
| Meta/Llama (groq) | A (right-size) | 0.90 | true |
| SambaNova | A (right-size) | 0.90 | true |

Unanimous, no dissent. Verdict: right-size #3255 to the residual; Phase-0 closes this gate; Phase-1 is the
single `epic-scaffold` ticket (see [companion](governance-epic-creation-reconciliation.md)).
