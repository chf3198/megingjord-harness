# Decisions Log

This file is the canonical, portable-by-default record of architectural
decisions made in this repo. It is the **fallback decisional surface** for
operators without GitHub Discussions access (air-gapped, offline-during-
decision-time). Per #1628 G5 Portability contract.

## Block schema

Each decision is appended as a structured Markdown block:

```
## YYYY-MM-DD — D-NNNN: <short title>

- **Status**: proposed | accepted | superseded by D-NNNN | deprecated
- **Decided-by**: <human alias>
- **Team-context**: <claude-code | copilot | codex | cross-team>
- **Surface**: <discussion-link | issue-link | offline>
- **Decision**: 1-3 sentence statement of what was decided.
- **Why**: 1-3 sentence rationale.
- **Alternatives considered**: <bulleted list or N/A>
- **Consequences**: <bulleted list or N/A>
```

## Authoring rules

1. New blocks are **appended** to the bottom of this file. Never reordered.
2. Numbering is monotonic (D-0001, D-0002, ...). The latest block determines next ID.
3. To supersede a prior decision, write a new block referencing the prior ID
   in the **Status** field. Do not edit the prior block.
4. Commit message must include `Refs decisions/D-NNNN`.

## Composition with GitHub Discussions (#1633)

| Surface | When | Cross-link |
|---|---|---|
| GitHub Discussion | Online; multi-operator participation; decisional debate | Link the Discussion in **Surface** field |
| `decisions.md` | Offline; air-gapped; quick single-operator note; or *after* a Discussion crystallizes | Link the Issue/Discussion if any |
| Issue | When the decision implies a shippable deliverable | Closes the loop |

Pattern: Discussion → decision → `decisions.md` block → Issue (if shippable).

## Composition with Projects v2 (#1630)

`decisions.md` is the **content store**; Projects v2 is the **live-state
overlay**. Per-decision rollup status (proposed → accepted) can be reflected
in Projects v2 fields if the harness chooses to surface it.

## Portability (per G5 contract, #1628)

- **Resource**: NONE. Pure file in repo.
- **Network**: NONE after clone.
- **Classification**: portable by default; works for every operator.
- **No opt-out needed**: file is always available.

## Initial entry

## 2026-05-15 — D-0001: Adopt the decisions.md pattern

- **Status**: accepted
- **Decided-by**: Orla Mason (claude-code:opus-4-7@anthropic, Manager)
- **Team-context**: cross-team
- **Surface**: Issue #1636 (this ticket)
- **Decision**: Adopt the Squad-style append-only decisions.md as the harness's portable-by-default decisional surface.
- **Why**: Research #1624 F10 identified this pattern as the only zero-dependency decisional surface; serves as fallback for operators without GitHub Discussions access.
- **Alternatives considered**:
  - ADR per-file in `docs/adr/` — heavier; fragments rationale.
  - Discussions-only — fails the G5 portability test for air-gapped operators.
  - Wiki — non-versioned; loses git history.
- **Consequences**:
  - Merge conflicts on the file are expected when multiple operators decide in parallel; resolution is append-both-blocks.
  - Block ordering is by acceptance date, not decision number.
  - Validator follow-on (AC3) will enforce schema; AC4 follow-on adds a lint check.

## Related

- #1636 — parent (this pattern adoption)
- #1633 — Discussions/Issues split (live decisional surface)
- #1630 — Projects v2 (live state overlay)
- #1628 — G5 Portability contract
- #1624 — research source (F10)
