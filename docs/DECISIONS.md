# Architecture Decision Records — Index

ADRs document significant architecture and process decisions for Megingjord.
The canonical store is [`research/adr/`](../research/adr/) — this file is an
index, not a duplicate. To prevent split source-of-truth, **never** add
decision records under `docs/DECISIONS/`; always add them to `research/adr/`.

## How to add a new ADR

1. Pick the next sequential number (current highest: 011).
2. Copy `research/adr/README.md` template structure into `research/adr/NNN-slug.md`.
3. Fill in: Status (Proposed / Accepted / Deprecated / Superseded), Date,
   Context, Decision, Consequences, Alternatives Considered.
4. Reference any superseded ADR with a "Supersedes ADR-XXX" line.
5. Update this index in the same PR.
6. Link the ADR from related skills, instructions, or design docs.

The `manager-ticket-lifecycle` baton workflow applies: ADRs that change
governance must go through Manager → Consultant; technical-only ADRs may be
admin-tracked.

## Existing ADRs

| # | Title | File |
|---|-------|------|
| 001 | Skills as Versioned Code | [`001-skills-as-code.md`](../research/adr/001-skills-as-code.md) |
| 002 | Dashboard Stack — Alpine.js + Static | [`002-dashboard-stack.md`](../research/adr/002-dashboard-stack.md) |
| 003 | Free-Tier Failover Routing | [`003-failover-routing.md`](../research/adr/003-failover-routing.md) |
| 004 | Global Task Router | [`004-global-task-router.md`](../research/adr/004-global-task-router.md) |
| 004 | Model Routing via Custom Agents | [`004-model-routing-agents.md`](../research/adr/004-model-routing-agents.md) |
| 005 | Ticket-Driven Work Management | [`005-ticket-driven-work.md`](../research/adr/005-ticket-driven-work.md) |
| 006 | Visual QA Gate for Web Releases | [`006-visual-qa-gate.md`](../research/adr/006-visual-qa-gate.md) |
| 007 | LLM Wiki Knowledge System Adoption | [`007-llm-wiki-adoption.md`](../research/adr/007-llm-wiki-adoption.md) |
| 008 | Canonical Ticket Lifecycle and Status-Role Binding | [`008-canonical-ticket-lifecycle.md`](../research/adr/008-canonical-ticket-lifecycle.md) |
| 009 | GitHub Feature Adoption | [`009-github-feature-adoption.md`](../research/adr/009-github-feature-adoption.md) |
| 010 | Ticket Status–Role Ownership Binding Model | [`010-ticket-status-role-model.md`](../research/adr/010-ticket-status-role-model.md) |
| 011 | Fleet Auto-Discovery Architecture | [`011-fleet-auto-discovery.md`](../research/adr/011-fleet-auto-discovery.md) |

## Known issues

- ADR-004 has a duplicate number (Global Task Router and Model Routing via
  Custom Agents). One should be renumbered when a related change next touches
  the routing subsystem; both are referenced from active instructions today,
  so renumbering blindly would create dangling links.
- README.md under `research/adr/` is the long-form contributor guide; this
  file is the navigation index for the broader documentation set.

## Related

- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — system map (subsystems linked to ADRs)
- [`docs/HELP-GUIDELINES.md`](HELP-GUIDELINES.md) — HELP panel UX patterns
- [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) — canonical terminology
