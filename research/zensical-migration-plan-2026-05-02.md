# Zensical Migration Plan — Megingjord Documentation

**Date**: 2026-05-02
**Ticket**: #802 (Phase 7 of Epic #795)
**Status**: research + plan only; implementation deferred to a separate child ticket

## Context (verified facts only)

Per the Phase 7 verification round, framing must reflect verified primary sources, not the original ticket's overstatements:

- **Material for MkDocs is in maintenance mode**, not sunsetting on a fixed date. The 2025-11-05 announcement guarantees critical-bug + security fixes for **≥12 months** (i.e. through ~Nov 2026 minimum). No specific deletion date is published.
- **Zensical performance language is qualitative**: "milliseconds instead of minutes" for incremental builds. The "4-5× faster differential builds" claim circulating in summaries is **unsourced** and must not be repeated.
- **Zensical lineage**: Rust core, MIT license, MkDocs-compat, written by the same squidfunk team that maintains Material for MkDocs. Treat as the official successor.

## Migration timing

- **Runway**: at minimum through Nov 2026, with explicit security fixes guaranteed.
- **Recommendation**: no rush. Use the runway. Migrate when:
  - Zensical reaches a stable 1.0 with the plugin set we depend on, **AND**
  - Either (a) a meaningful build-time pain point appears, or (b) Material's maintenance cadence visibly slips.

Either trigger justifies the migration; neither is currently true.

## Plugin / config map

Megingjord does not currently use Material for MkDocs at the time of this plan. Documentation lives in plain markdown under `docs/`, `research/`, and `wiki/`, served via GitHub's native rendering. The Diátaxis IA audit (companion document) suggests reorganizing toward a Tutorial/How-to/Reference/Explanation layout, which both Material and Zensical can render cleanly.

If/when we adopt Zensical:

| Today | Migration step |
|---|---|
| Plain markdown viewed via GitHub | `mkdocs.yml` (Zensical-compatible) declared |
| log4brains (#798) static site for ADRs | Stays as separate static; embed link from Zensical sidebar |
| `npm run docs:compile` (#796) | Stays; produces README scripts table consumed by both |
| `npm run docs:anchors` (#797) | Stays; orthogonal to renderer |

Zensical's MkDocs-compat means `mkdocs.yml` syntax is the input today; plugin compatibility is the open question.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Zensical remains pre-1.0 longer than planned | Medium | Material runway covers ≥12 months; reassess at 6 months. |
| Plugin we depend on doesn't port | Medium | Catalog needed plugins before migration; raise issue upstream early. |
| Material reaches end-of-security earlier than announced | Low | Monitor squidfunk repo activity; the 12-month commitment is in writing. |
| Diátaxis reorganization conflicts with renderer choice | Low | Markdown source is renderer-agnostic; any reorg lands first. |

## Decision

Defer Zensical migration. Re-evaluate at one of:

- 2026-08-15 (mid-runway check-in)
- Zensical 1.0 release announcement
- First sign of Material maintenance slip

Diátaxis reorganization (separate child ticket) is independent and can land at any time.

## Out of scope

- Actual `mkdocs.yml` config or build-time setup — those land in an implementation ticket post-client-review.

## Sources

- Material for MkDocs maintenance-mode announcement: https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/
- Zensical setup docs: https://zensical.org/docs/setup/basics/
- Verification round on Epic #795 (2026-05-02): caught the unsourced "4-5×" multiplier and the missing fixed sunset date

Refs #802, #795
