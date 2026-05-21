# Deliverable 5 — Adversarial counter-argument

Phase-0 ticket: #2038. Parent Epic: #2037.

## The strongest argument against full programmatic replacement

This document deliberately argues AGAINST the Epic #2037 thesis. The counter-arguments below must be honored in the Phase-1 plan — they are the irreducible LLM-intervention surfaces.

## Counter-argument 1 — AC verification narrative is irreducibly judgment-driven

**Position**: AC verification ("AC2: rubric scorer supports G1-G10 — PASS") is structured (status ∈ {PASS, FAIL, DEFERRED, N/A}). But the *rationale* ("PASS — validateRubric now derives max-goal from rubric.version per-instance, ensuring v3 supports 10 goals while v2 backward-compat preserved; verified across 9 unit tests including legacy-state backfill") cannot be templated.

**Why**: The rationale combines:
- The specific implementation choice (one of many possible)
- The specific test that proves it
- The specific backward-compat surface
- The specific edge case caught

A template can render "AC2 — {{status}}: {{rationale}}". The {{rationale}} fill is LLM judgment.

**Phase-1 implication**: The structured-input schema MUST include a per-AC `rationale` string slot. The template renders the assembly; LLM fills the slot. **Programmatic structure, LLM narrative.** Not "full" replacement.

## Counter-argument 2 — Mid-flight flaw decisions are contextual

**Position**: The anneal-decision protocol (file-ticket | log-incident-only | memory-note-only | no-action-justified) is a four-option enum. But choosing among the four — and writing the rationale — depends on:
- Whether the flaw is a recurring pattern (file-ticket) or one-off (log-incident-only)
- Whether the operator-judgment surfaces a process insight (memory-note-only)
- Whether the flaw is justified by goal-lens override (no-action-justified)

**Why**: This is exactly the kind of judgment LLM-as-judge does well. A pure-deterministic version would either over-file tickets (false positives, contributes to ticket noise per memory `feedback_anneal_emission_during_implementation`) or under-file (false negatives, surfaces months later).

**Phase-1 implication**: structured `anneal_decision` enum + LLM-authored `rationale` slot. Validator enforces enum membership; rationale is free-form.

## Counter-argument 3 — Cross-team coordination is contextual prose

**Position**: TEAM_QUESTION + TEAM_RESPONSE comments coordinate work across runtime boundaries. Their structure is partially template-able (target_team, schema_source, verdict). But the QUESTION text itself ("we're about to write `.claude/settings.json` — can you verify the hook-entry schema before we ship?") is contextual to the specific cross-team write.

**Why**: Each cross-team interaction has unique context. The pattern occurs rarely enough (#1917 was the canonical case) that the variability cost of LLM authorship is low.

**Phase-1 implication**: keep TEAM_QUESTION + TEAM_RESPONSE as LLM-generated with template-enforced field requirements (signer fields, verdict enum). Don't force them into the strict baton-handoff template path.

## Counter-argument 4 — Epic-level synthesis (CONSULTANT_EPIC_CLOSEOUT)

**Position**: An Epic closeout requires synthesizing:
- N children's outcomes (variable N)
- Per-Epic rubric (deterministic via rubric-score.js)
- Anneal-tickets-filed (cumulative across the Epic)
- Mid-flight-flaws-accounting (cumulative)
- A judgment about whether the Epic is closeable

**Why**: The "judgment about closeability" especially is irreducible. The deterministic AC-by-AC check IS template-able (per-AC status + rationale), but the synthesis is LLM work.

**Phase-1 implication**: per-child table renders deterministically from data. The Epic-level synthesis sits in a `synthesis_narrative` field, LLM-filled.

## Counter-argument 5 — Programmatic generation entrenches taxonomy

**Position**: If every artifact is template-rendered, the templates become the de-facto schema. Changing the schema means changing every template + every input source. That's brittle compared to LLM authorship that adapts to changing requirements.

**Why**: Schema-as-code has a real cost. If governance taxonomy evolves rapidly (and the harness has been evolving rapidly — G9 → G10 just shipped), schema-bound artifacts must evolve in lock-step.

**Phase-1 implication**: schema versioning + transition windows must be a first-class concept. Each artifact type carries `schema_version` field. Template registry maps version → template. Migration path: dual-emission (old + new) for a soak window (replay-eval-gated, NOT calendar-day-gated per memory `feedback_calendar_thresholds_in_agentic_systems`).

## Counter-argument 6 — Operator-voice is part of governance attribution

**Position**: Each runtime team's "voice" (the prose flavor of CC vs Copilot vs Codex artifacts) is implicit metadata about WHICH TEAM authored the work. Identical bytes-output across teams would erase this signal.

**Why**: When a downstream operator reviews an Epic, distinguishing "this was Claude Code's framing" from "this was Codex's framing" matters for trust calibration and for spotting cross-team pattern divergence.

**Phase-1 implication**: a `team_voice_marker` field in the structured input optionally adds a one-line operator-flavor signature ("Drafted by [Claude Code Manager]"). The MAIN BODY is identical; the marker preserves attribution. This is non-load-bearing — purely informational.

## Counter-argument 7 — LLM authorship is the test of governance clarity

**Position**: If a governance instruction is so unclear that the LLM can't reliably produce a passing artifact, the INSTRUCTION needs work, not the artifact pipeline. Hiding the unclear instructions behind a template means the underlying governance doc stays unclear.

**Why**: The harness has accumulated 8 memory anchors about LLM artifact-generation failures (signer-alias, pr-title length, branch prefix, refs ordering, team-model substrate, role-colon collision, flaw-emission citation, research/ type prefix). Each is a sign that the instruction taxonomy is ambiguous. The right fix may be **clarify the instructions** (helps both LLM and operator) rather than **template around the instructions** (helps LLM, masks the problem from operator).

**Phase-1 implication**: schema authorship must drive instruction clarification. Each Phase-1 child shipping a new schema must also update the relevant `instructions/*.md` to point at the schema as canonical. The schema and the instruction are co-canonical.

## Counter-argument 8 — Cost of fielding the deterministic infra

**Position**: Template engines, JSON Schemas, replay-eval corpora, cross-runtime parity tests, migration tooling — that's a substantial deterministic infrastructure that costs engineering effort. LLM authorship "just works" with no infra.

**Why**: The "just works" of LLM authorship has hidden cost in remediation cycles (every CI failure is operator time fixing the artifact). The deterministic infra has upfront cost amortized across all future artifacts. There's a crossover point.

**Phase-1 implication**: prioritize the highest-volume + highest-failure-rate artifacts first. Baton-handoff comments (every ticket; 4 per ticket; ~50 tickets per session = 200 comments) probably justify the infra. Single-use artifacts (TEAM_QUESTION) may not.

## Synthesis

Of 8 counter-arguments, **5 require Phase-1 design accommodation** (LLM-narrative slots, anneal-decision rationale, cross-team free-form, Epic synthesis, team-voice marker). 3 are higher-order concerns to weigh (schema entrenchment, governance-clarity test, infra cost) but don't block the Phase-1 plan.

The recurring theme: **programmatic STRUCTURE + LLM SLOTS, not full replacement.** The Epic title should probably be re-framed from "programmatic execution" to "programmatic structure with LLM-filled slots." The thesis is sharpened by the counter-argument.

## Phase-1 plan adjustments from counter-arguments

(This will be reflected in Deliverable 4 Plan v2.)

1. Schema MUST include LLM-narrative slot fields (`rationale`, `synthesis_narrative`, `decision_rationale`)
2. Template MUST render structure-and-slot, not full prose
3. Schema-version field MUST be first-class for migration
4. Optional `team_voice_marker` for attribution
5. Each schema-defining child MUST also update the relevant instruction
6. Phase-1 prioritization MUST follow volume × failure-rate ranking
7. TEAM_QUESTION + TEAM_RESPONSE explicitly remain LLM-generated with schema-enforced field requirements only

## References

- Memory: `feedback_anneal_emission_during_implementation`, `feedback_calendar_thresholds_in_agentic_systems`, the 8 LLM-failure memories cited in Deliverable 1
- Origin: operator session 2026-05-21 directive + Deliverable 2 cutting-edge research
