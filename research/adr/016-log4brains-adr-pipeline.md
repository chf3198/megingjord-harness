# ADR-016: log4brains as the ADR Pipeline

**Status**: Accepted
**Date**: 2026-05-02
**Supersedes**: hand-maintained `docs/DECISIONS.md` index (kept as a static navigation pointer)

## Context

ADRs were tracked in `research/adr/` with a hand-edited
`docs/DECISIONS.md` index. The index drifted from the actual files at
multiple points (most recently in Phase 0 of Epic #795, where
ADR-011/012/013 had been added without index updates), and the
ADR-004 number collision (Global Task Router vs. Model Routing via
Custom Agents) accumulated for ~9 months. We needed a tool that:

- Auto-generates the index from the file collection.
- Provides a templated, MADR-compatible authoring path.
- Supports static publishing for offline/portable browsing.

## Decision

Adopt **log4brains v1.1.0** as the ADR pipeline:

- Config: `.log4brains.yml` points at `research/adr/`.
- Authoring: `npm run adr:new -- "title"` creates a new MADR file with proper numbering.
- Preview: `npm run adr:preview` opens a local web UI.
- Build: `npm run adr:build` produces a static site (`.log4brains/out/`).

Existing 13 ADRs (001–013) are preserved as-is. ADR-014 was already
in place (Fleet Model Placement on Windows Hosts). The duplicate
ADR-004 was renumbered: `004-model-routing-agents.md` → `015-model-routing-agents.md`
via `git mv` to preserve history.

`docs/DECISIONS.md` is retained as a one-line pointer to the canonical
log4brains-rendered index, plus a brief contributor guide for adding
new ADRs.

## Consequences

### Positive

- Auto-generated index removes the drift class entirely.
- MADR templates standardize new ADR shape.
- Static site can be published to GitHub Pages in a follow-up if/when desired.
- Preview server enables hot-reload editing during ADR drafting.

### Negative / risks

- **Slow upstream cadence** (verified during Phase 2 verification round): log4brains v1.1.0 was released 2024-12-17. The package still works and remains the most feature-complete ADR pipeline (MADR-default, IDE-integrated, static-publish), but adoption accepts the risk that fixes may lag. Mitigation: vendor or fork the npm package if upstream goes dark.
- One additional devDependency to track in routine `npm audit` triage.
- GitHub Pages publish workflow deferred to a follow-up ticket.

## Alternatives Considered

- **Keep `docs/DECISIONS.md` hand-maintained** — what we had. Drift cost was real but bounded; the manual maintenance load is one update per ADR (~15 ADRs total). Rejected because the drift kept happening despite policy.
- **`adr-tools` (npryce)** — entirely stagnant; last release 2018. Rejected outright.
- **Custom in-repo script** — would duplicate features that log4brains already provides; rejected on YAGNI grounds.

## Phase 3 of Epic #795

Refs #798, #795
