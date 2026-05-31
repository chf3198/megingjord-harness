# Megingjord — Global Governance Harness

Cross-team contract entry point: `governance/README.md` (4 invariants:
Team&Model signing, baton order, ticket-first workflow, dedicated worktree per
concurrent agent). This file is the Antigravity adapter.

## Invariants

1. **Team&Model signing** — all governed artifacts carry `Signed-by` + `Team&Model` provenance.
2. **Baton order** — Manager → Collaborator → Admin → Consultant; one role active per ticket.
3. **Ticket-first** — no code or config work without a linked GitHub issue; every commit refs `#N`.
4. **Dedicated worktree** — each concurrent agent session uses an isolated worktree + branch.

## Harness goals (priority order)

Governance > Quality > Zero Cost > Privacy > Portability > Resilience >
Throughput > Observability > Interoperability > Maintainability.

## Adapter notes

- Use `governance/README.md` as the canonical contract source.
- Repo-local governance files may extend or tighten this baseline.
- Runtime home for Antigravity assets: deploy through governed workflow only.
