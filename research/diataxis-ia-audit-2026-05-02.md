# Diátaxis IA Audit — Megingjord Documentation

**Date**: 2026-05-02
**Ticket**: #802 (Phase 7 of Epic #795)

## Summary

Classify Megingjord's documentation surface against the four Diátaxis quadrants (Tutorial / How-to / Reference / Explanation). Identify gaps, duplications, and placement misfits. Output is a placement matrix; reorganization is a separate child ticket.

## Diátaxis quadrants (recap)

| | Practical | Theoretical |
|---|---|---|
| Learning-oriented | **Tutorial** | **Explanation** |
| Goal-oriented | **How-to** | **Reference** |

- **Tutorial**: lesson, hand-holding, "learning by doing." Reader is new.
- **How-to**: recipe, problem-solving, "I need to accomplish X." Reader knows the goal.
- **Reference**: lookup, dry, complete. Reader knows what they're searching for.
- **Explanation**: discussion, why-this-decision, big-picture. Reader has time and curiosity.

## Classification matrix

### Tutorials (learning by doing)

Currently: **0 surfaces.** This is the largest gap. New contributors arrive at `README.md` (which is closer to a Reference summary) and have no guided "first hour" path.

### How-to (goal-oriented)

| Surface | Quadrant fit | Notes |
|---|---|---|
| `docs/howto/baton-workflow.md` | ✅ How-to | Strong: "if you're playing role X, do these steps" |
| `docs/howto/contribute-to-wiki.md` | ✅ How-to | New (#803); walkthrough of `wiki:ingest` |
| `docs/howto/fleet-routing.md` | ✅ How-to | Strong |
| `docs/howto/help-inventory.md` | ⚠️ Mixed | Lists HELP topics; closer to Reference |
| `docs/howto/doc-update-trigger-matrix.md` | ⚠️ Mixed | Decision matrix; partially Reference |

### Reference (lookup)

| Surface | Quadrant fit | Notes |
|---|---|---|
| `docs/STYLE-GUIDE.md` | ✅ Reference | Canonical terminology |
| `docs/HELP-GUIDELINES.md` | ✅ Reference | UX patterns lookup |
| `docs/DECISIONS.md` | ✅ Reference (index) | Auto-rendered now (#798) |
| `research/adr/*.md` | ✅ Reference | Each ADR is Reference for one decision |
| `instructions/*.instructions.md` | ✅ Reference (governance) | "What rules apply when" |
| `WIKI.md` | ✅ Reference | Wiki schema |
| `README.md` | ⚠️ Mixed | Auto-scripts table is Reference; vision blurb is Explanation |
| `AGENTS.md` | ✅ Reference | Agent inventory |
| `CLAUDE.md` | ✅ Reference | Claude runtime config |
| `CHANGELOG.md` | ✅ Reference | Version history |

### Explanation (why)

| Surface | Quadrant fit | Notes |
|---|---|---|
| `docs/ARCHITECTURE.md` | ✅ Explanation | System map; explains the why |
| `research/adr/*.md` (Context + Consequences sections) | ✅ Explanation | The "why" portions of each ADR |
| `research/*.md` (non-ADR research) | ✅ Explanation | Forward-looking analysis |
| `wiki/syntheses/*.md` | ✅ Explanation | Cross-cutting analysis |
| `wiki/concepts/*.md` | ⚠️ Mixed | Some are Explanation, some are Reference |

## Identified gaps

1. **Tutorial gap (severity: high)** — no "first hour with Megingjord" walkthrough. Closest is `README.md` quick-start, which is too dense for a learner.
2. **Mixed HELP inventory** — `docs/howto/help-inventory.md` lists HELP topics but is essentially Reference; should move to `docs/reference/help-inventory.md` or remain explicitly named as Reference.
3. **README role overload** — README mixes Reference (scripts table, runtime mapping), How-to (quick-start), and Explanation (vision + "why robust"). Acceptable for a project README but worth tracking.
4. **Wiki concept/synthesis fuzziness** — boundary between `wiki/concepts/` (Reference) and `wiki/syntheses/` (Explanation) is not always clear. Document the rule in `WIKI.md`.

## Identified duplications

- `docs/DECISIONS.md` is a Reference index of ADRs; `research/adr/README.md` is also a Reference index. Two indices for the same content. Recommendation: keep `docs/DECISIONS.md` as the canonical index (it's auto-rendered via log4brains since #798); convert `research/adr/README.md` to a contributor-style How-to ("how to add an ADR").

## Recommended placements

For implementation in a separate child ticket:

- Create `docs/tutorial/first-hour.md` — guided walk through cloning, `npm run setup`, opening dashboard, running a baton, viewing wiki.
- Move `docs/howto/help-inventory.md` → `docs/reference/help-inventory.md`.
- Convert `research/adr/README.md` → "how to add a new ADR" walkthrough (How-to), referencing log4brains.
- Add a `WIKI.md` clarifier on concepts vs. syntheses boundary.

## Out of scope

- Any actual moves or rewrites — those land in a follow-up implementation ticket post-client-review per Manager scope.

## Sources

- Diátaxis: https://diataxis.fr/
- Inventory of current docs: `find docs/ instructions/ research/adr -name "*.md"` (2026-05-02)

Refs #802, #795
