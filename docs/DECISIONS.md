# Architecture Decision Records — Index

ADRs document significant architecture and process decisions for Megingjord.
Canonical store: [`research/adr/`](../research/adr/).

This index is **auto-renderable** — run `npm run adr:preview` for the
hot-reload web UI or `npm run adr:build` for a static site.
The hand-edited table below remains as a quick navigation reference.

## How to add a new ADR

```bash
npm run adr:new -- "decision title"
```

This scaffolds a MADR-templated file under `research/adr/`. Fill in
Status, Context, Decision, Consequences, Alternatives. The
log4brains pipeline auto-numbers and indexes the new ADR.

ADRs that change governance must follow Manager → Consultant baton.

## Existing ADRs

| # | Title | File |
|---|-------|------|
| 001 | Skills as Versioned Code | [`001-skills-as-code.md`](../research/adr/001-skills-as-code.md) |
| 002 | Dashboard Stack — Alpine.js + Static | [`002-dashboard-stack.md`](../research/adr/002-dashboard-stack.md) |
| 003 | Free-Tier Failover Routing | [`003-failover-routing.md`](../research/adr/003-failover-routing.md) |
| 004 | Global Task Router | [`004-global-task-router.md`](../research/adr/004-global-task-router.md) |
| 005 | Ticket-Driven Work Management | [`005-ticket-driven-work.md`](../research/adr/005-ticket-driven-work.md) |
| 006 | Visual QA Gate for Web Releases | [`006-visual-qa-gate.md`](../research/adr/006-visual-qa-gate.md) |
| 007 | LLM Wiki Knowledge System Adoption | [`007-llm-wiki-adoption.md`](../research/adr/007-llm-wiki-adoption.md) |
| 008 | Canonical Ticket Lifecycle and Status-Role Binding | [`008-canonical-ticket-lifecycle.md`](../research/adr/008-canonical-ticket-lifecycle.md) |
| 009 | GitHub Feature Adoption | [`009-github-feature-adoption.md`](../research/adr/009-github-feature-adoption.md) |
| 010 | Ticket Status–Role Ownership Binding Model | [`010-ticket-status-role-model.md`](../research/adr/010-ticket-status-role-model.md) |
| 011 | Fleet Auto-Discovery Architecture | [`011-fleet-auto-discovery.md`](../research/adr/011-fleet-auto-discovery.md) |
| 012 | Multi-Agent Worktree Path Governance | [`012-multi-agent-worktree-governance.md`](../research/adr/012-multi-agent-worktree-governance.md) |
| 013 | Capability Detection Substrate | [`013-capability-detection-substrate.md`](../research/adr/013-capability-detection-substrate.md) |
| 014 | Fleet Model Placement on Windows Hosts | [`014-fleet-model-placement-on-windows-hosts.md`](../research/adr/014-fleet-model-placement-on-windows-hosts.md) |
| 015 | Model Routing via Custom Agents (renumbered from ADR-004) | [`015-model-routing-agents.md`](../research/adr/015-model-routing-agents.md) |
| 016 | log4brains as the ADR Pipeline | [`016-log4brains-adr-pipeline.md`](../research/adr/016-log4brains-adr-pipeline.md) |
| 017 | package-lock.json — Commit vs. Gitignore Decision | [`017-package-lock-decision.md`](../research/adr/017-package-lock-decision.md) |
| 018 | Enable GitHub Actions to create and approve pull requests | [`018-actions-pr-permission.md`](../research/adr/018-actions-pr-permission.md) |

## Resolved issues

- The historical ADR-004 duplicate (Global Task Router vs. Model Routing via Custom Agents) was resolved in Phase 3 of #795: the routing-agents file was renumbered to ADR-015 via `git mv`. See ADR-016 for the log4brains adoption that prevents future drift.

## Related

- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — system map (subsystems linked to ADRs)
- [`docs/HELP-GUIDELINES.md`](HELP-GUIDELINES.md) — HELP panel UX patterns
- [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) — canonical terminology
