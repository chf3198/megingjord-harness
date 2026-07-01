# Decisions Log

> **Canonical role (Epic #3124 D8):** the chronological decisions *log* — distinct from
> [`DECISIONS.md`](DECISIONS.md) (the ADR *index*). The case-variant filenames are intentional but
> serve different purposes; see [`diataxis-taxonomy.md`](diataxis-taxonomy.md).

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

## 2026-07-01 — D-0002: Additive resurfacing signals use `signal:*`, not `status:*`

- **Status**: accepted
- **Decided-by**: Orla Mason (claude-code:claude-opus@local, Manager)
- **Team-context**: claude-code
- **Surface**: Issue #3525 / Epic #3517 (ADR-020 §D1/§D2/§D3 label naming)
- **Decision**: The three additive closure-readiness signals defined by ADR-020 are named `signal:close-eligible`, `signal:exempt-review`, and `signal:contested-superseded` — a dedicated `signal:*` namespace — rather than the ADR's literal `status:*` names. `resolution:superseded` (a terminal reason, applied once at close) keeps its `resolution:*` namespace.
- **Why**: ADR-010 / Epic #1828 AC6 enforces exactly ONE `status:*` label per issue, and lifecycle statuses are mutually-exclusive transitions (e.g. `status:in-progress` → `status:dormant` REPLACES, per `epic-dormancy-detector.js`). These three signals are ADDITIVE — an epic stays `status:in-progress` while ALSO being flagged close-eligible/exempt-review/contested — so naming them `status:*` would violate the one-status cardinality invariant enforced by `label-lint-status-cardinality.js`. A separate namespace preserves G1 governance (no rule weakening) and matches industry convention (status vs. signal/needs labels).
- **Alternatives considered**:
  - Keep `status:*` and exempt these three in the cardinality rule — weakens the #1828 invariant and expands ADR-010's scope from an implementation ticket; rejected.
  - Make them lifecycle transitions that replace the current status — semantically wrong (a close-eligible epic is still active/open); rejected.
- **Evidence**: resolved autonomously per the operator-autonomy principle (reversible, low-risk label naming; no client touch — client is design/UAT only). Cross-family panel (llama3.1:8b + qwen2.5:7b-instruct, both non-Anthropic, $0 local fleet) + web research (GitHub label-convention best practice) were unanimous on a separate signal namespace.
- **Consequences**:
  - ADR-020's `status:*` label literals are superseded by this decision for implementation; the ADR text is annotated in the #3525/#3519/#3526 PRs rather than rewritten (research artifact immutability).
  - `signal:*` becomes a new label group in `label-manifest.json`; `signal:contested-superseded` lands in #3525, `signal:close-eligible` in #3519, `signal:exempt-review` in #3526.
