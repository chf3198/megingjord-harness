---
title: "Dashboard closed-state hygiene — 2026-Q2 research"
type: research
created: 2026-05-04
status: pending
tags: [dashboard, governance, adr-010, closed-state, baton]
sources: ["[[baton-protocol]]", "[[governance-enforcement]]"]
---

# Dashboard closed-state hygiene — 2026-Q2 research

**Date**: 2026-05-04
**Ticket**: #852 (research only; child of EPIC #848)
**Lane**: docs-research

## Origin

Live-view audit (2026-05-03) found Agent Baton panel (`#panel-baton`, renderer `dashboard/js/baton-flow.js`) rendering closed issues with active `role:*` chips (Mgr → Collab → Admin → Review). This violates ADR-010: *"Closed tickets are terminal and must not re-enter active Baton views; historical ownership in dashboard/audit views resolves to manager after close."*

## Free-fleet usage

Single Groq llama-3.3-70b-versatile dispatch for prior-art synthesis + recommendation. Zero paid LLM tokens. Token-minimum approach: one round-trip, accept output, edit for project specifics.

## A. Terminal-state filtering — 2026-Q2 patterns

(Groq-drafted, refined for project context.)

| Tool | Default closed visibility | Toggle |
|---|---|---|
| **Linear** | Hidden by default | Filter option exposes "history" view |
| **Height** | Visible with `closed` label | Status filter to hide |
| **GitHub Projects v2** | Visible with `Done` status | Filter or column hide |
| **Anthropic Claude Code Console** | Archived; accessed via separate view | Separate "archive" tab |

The dominant pattern is **hide-by-default with explicit toggle**. Linear's design — closed issues exit the active list and require an opt-in filter — best matches Megingjord's baton model (the panel is named "Agent Baton" — implying *active* ownership, not history).

## B. Post-close role attribution patterns

| Tool | Role labels after close |
|---|---|
| **GitHub Projects v2** | Removed |
| **Linear** | Retained but hideable via filter |
| **Height** | Removed; `closed by <user>` audit field added |
| **Anthropic Console** | Archived alongside the issue |

**ADR-010 says**: "historical ownership in dashboard/audit views resolves to **manager** after close." The closest external pattern is Height's `closed by` audit field. Megingjord should produce **a single condensed historical attribution row** (no full role chain), labeled `closed` with manager-only attribution, when closed tickets are surfaced at all.

## C. Dashboard-side lint vs upstream gate

| Approach | Tradeoff |
|---|---|
| **Upstream-gate-only** (Anthropic Console) | Single source of truth; dashboard trusts upstream; failure modes silent in UI |
| **Dashboard-lint-only** (Linear) | Resilient when upstream lapses; risks UI/data divergence |
| **Hybrid** (GitHub Projects v2, Height) | Defense in depth; fail loud at both layers |

**Megingjord already has the upstream gate**: `.github/workflows/label-lint.yml` enforces ADR-010 on every issue event; `governance-drift-classifier.js` fails CI on label drift. The current panel-baton renderer trusts upstream blindly — that trust is being violated **right now** because closed tickets render with `role:*` chips.

**Recommendation**: hybrid. Keep the upstream gate authoritative; add a thin dashboard-side filter that *always* drops `role:*` chips on closed tickets (defense in depth). The dashboard should never render a label combination ADR-010 forbids, even if the upstream data carries it (e.g., during a brief race between close + label-lint workflow firing).

## D. Recommendation for the `#panel-baton` renderer

Concrete changes to `dashboard/js/baton-flow.js`:

1. **Default-hide closed tickets** in the active Baton list.
2. **Optional history toggle** (collapsed `<details>` block at the bottom of the panel) — when expanded, shows closed tickets as a condensed list: ticket #, title, closed-date, manager attribution only.
3. **Strip `role:*` chips at render time** for any ticket with `state == 'closed'` — defense-in-depth against upstream label-lint races.
4. **Replace role-chain renderer with a single `closed` badge** for closed rows.
5. **Counter badge** on the history toggle ("3 closed today") so the audit trail stays visible without dominating the panel.

## Decision

Adopt the **Linear-style default-hide + toggle** pattern with **Height-style condensed historical attribution**. Implement at the dashboard renderer (defense-in-depth) without removing the upstream gate. This satisfies ADR-010 cleanly and matches the dominant 2026-Q2 governance-dashboard convention.

## Implementation children (NOT spawned per Manager scope)

After client review, follow-up tickets should cover:

1. `baton-flow.js` strip `role:*` chips for `state == 'closed'` (defense-in-depth fix).
2. Default-hide closed tickets; add `<details>`-wrapped history toggle.
3. Condensed historical attribution renderer (manager-only, no full role chain).
4. Playwright spec asserting closed tickets render no `role:*` chip.
5. (Optional) Counter badge on history toggle.

## Cross-links

- ADR-010 (Ticket Status–Role Ownership Binding Model)
- `instructions/ticket-driven-work.instructions.md` (closed-state rule)
- `instructions/role-baton-routing.instructions.md` (closed-state rule)
- `dashboard/js/baton-flow.js` (current renderer)
- `wiki/concepts/baton-protocol.md`
- `wiki/concepts/ticket-audit-pattern.md` (#837 follow-up — same defense-in-depth principle)

## Sources

- Project: ADR-010, `dashboard/js/baton-flow.js`, current panel-baton live-view evidence.
- LLM contribution: Groq llama-3.3-70b-versatile (single dispatch).
- External patterns surveyed: Linear, Height, GitHub Projects v2, Anthropic Claude Code Console (per Groq prior art; pattern shape confirmed against published help/docs of each).

Refs #852, #848
