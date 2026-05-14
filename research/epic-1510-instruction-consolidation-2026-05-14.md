# Epic #1510 — Instruction-channel consolidation audit

**Authority:** Claude Code Team Collaborator (Orla Harper)
**Date:** 2026-05-14
**Scope:** Satisfies Epic #1510 AC4. Identifies content in `instructions/**/*.md` that the new lint rules now enforce mechanically, so prose can be trimmed or de-duplicated.
**Source of truth:** [inventory/coding-practice-coverage.json](../inventory/coding-practice-coverage.json)

## 1. What changed for Phase-1

```
Before Epic #1510 (Phase-0):
  ~5 enforced practice rules + 9 megalint  → ~14 lint surfaces
  Coverage estimate: 50-83% (wide range; un-calibrated)

After Phase-1 Bundle 1 (#1520):
  +3 new megalint validators (lint-as-ac, workflow-sha-pin,
                              test-discoverability)
  = 12 megalint validators total

After Phase-1 Bundle 2 (#1521 — this PR):
  + Manifest-driven coverage metric
  Coverage MEASURED: 84.8% of lintable (28/33)
  Target ≥ 70%  →  +14.8 points ABOVE target ✓
```

## 2. Practice statuses (per manifest)

```
+-------------------+-------+---------------------------------------+
| Status            | Count | Examples                              |
+-------------------+-------+---------------------------------------+
| lint-enforced     |  26   | file-size-100, single-letter-vars,    |
|                   |       | manager-handoff-schema, lint-as-ac,   |
|                   |       | workflow-sha-pin, test-discoverabil.  |
| tool-enforced     |   2   | use-edit-not-echo, read-before-edit   |
| instruction-only  |   5   | cyclomatic, no-no-verify, secret-leak,|
|                   |       | commit-conv-types, dep-import-boundary|
| model-judgment    |   2   | no-emoji-unless-asked, parallel-tools |
+-------------------+-------+---------------------------------------+
                       35   total
```

## 3. Consolidation recommendations

### 3a. Instruction prose now redundant with lint (DELETE/MOVE)

These practices are now mechanically enforced; the instruction prose serves only as documentation and can be condensed to a one-line reference.

```
+---------------------------+----------------------------------------+
| Instruction prose         | Replace with                           |
+---------------------------+----------------------------------------+
| CLAUDE.md "≤ 100 lines"   | One-line "see scripts/lint.js"         |
|                           | (5+ lines → 1 line; saves ~24 tokens)  |
+---------------------------+----------------------------------------+
| AGENTS.md "≤ 100 lines"   | Remove duplicate (CLAUDE.md sufficient)|
+---------------------------+----------------------------------------+
| readability-commenting    | Single-letter / magic-number /         |
|  governance.instructions  | function-length lines: condense to     |
|                           | "see scripts/global/lint-readability-  |
|                           | core.js" rule list                     |
+---------------------------+----------------------------------------+
| github-governance         | "Pin to SHA" → one-line ref to         |
|                           | megalint/workflow-sha-pin.js           |
+---------------------------+----------------------------------------+
| ticket-driven-work        | AC truthfulness paragraph → one-line   |
|                           | ref to megalint/body-ac-truthfulness   |
+---------------------------+----------------------------------------+
| team-model-signing        | "Use agent-signature.js" → already     |
|                           | concise; keep as-is (correctly minimal)|
+---------------------------+----------------------------------------+
```

Estimated token savings: ~200-400 per-session if all condensations applied. Not catastrophic, but additive across instruction files.

### 3b. Instruction prose to KEEP (legitimately not lintable)

These practices require model judgment or contextual interpretation; lint cannot enforce them without unacceptable false-positive rates.

```
+---------------------------------+------------------------------------+
| Practice                        | Why it stays in prose              |
+---------------------------------+------------------------------------+
| Goal-lens decision framework    | Per-decision judgment; no syntactic|
|                                 | shape lint can match               |
+---------------------------------+------------------------------------+
| "Prefer root-cause over band-   | Requires reasoning about the bug;  |
| aid fixes"                      | meta-instruction for the model     |
+---------------------------------+------------------------------------+
| "Don't add features beyond what | Scope judgment; instruction-only   |
| the task requires"              |                                    |
+---------------------------------+------------------------------------+
| Baton orchestration flow        | Process spec; megalint validates   |
|                                 | the artifacts, but the model       |
|                                 | needs the flow itself              |
+---------------------------------+------------------------------------+
```

### 3c. Deferred Phase-1 children (justify ≥70% without them)

The five `instruction-only` practices map to deferred Phase-1 children:

```
+---+-----------------------+-----------------------+------------------+
| # | Practice              | Phase-1 child needed  | Severity         |
+---+-----------------------+-----------------------+------------------+
| 1 | cyclomatic-complexity | Phase-1e (eslint cfg) | Med              |
| 2 | no-no-verify          | Phase-1d (git hook)   | High but model-  |
|   |                       |                       | obeys without it |
| 3 | secret-leak-prev      | Phase-1c (CI scan)    | High             |
| 4 | commit-conv-types     | Phase-1h (commitlint) | Med              |
| 5 | dep-import-boundary   | Phase-1f (depcruise)  | Med              |
+---+-----------------------+-----------------------+------------------+
```

**Justification for not blocking Epic close on these:** the Path-C decision in Phase-0 §7 explicitly defers med-severity rules to soak through Path D (advisory-first) in follow-up work. The high-severity items (#2 secret-scan, #3 no-no-verify) are real gaps but:

- **secret-scan** — partial coverage via GitHub's repository secret scanning (already enabled per `instructions/repo-health-onboarding.instructions.md`). Adds defense-in-depth, not the primary safeguard.
- **no-no-verify** — the model is instructed not to use it; no recurrence observed in this session's commits. Low actual-incidence risk.

These five practices file as follow-up tickets after Epic #1510 closes.

## 4. Coverage trend

```
Pre-#1510:     ~14 lint surfaces × ~30 practices = ~47% (Phase-0 estimate)
Post-#1486:    ~14 surfaces + merge-evidence pair  → ~50% (Phase-0 raw)
Post-#1520:    +3 megalint validators             → 70-75% (estimate)
Post-#1521:    Manifest-driven measurement        → 84.8% (real)

  ─── Target threshold (70%) ───────────────────────────────────
                                        █████████████████████
                                        █████████████████████
                                  ██████████████████████████
                            ████████████████████████████████
                  ████████████████████████████████████████
        ██████████████████████████████████████████████████
  ████████████████████████████████████████████████████████
  Pre-1486   Post-1486   Post-1520        Post-1521 (84.8%)
                              ↑ target line at 70%
```

## 5. Token-cost impact

Pre-#1510 instruction load: ~17,000 tokens/session across 24 files (per Phase-0 §4b).
Post-#1510 with §3a condensations applied: ~16,600 tokens/session (~2.4% reduction).

Not a dramatic reduction — the bigger gain is **drift prevention**: every practice now has either a lint enforcement OR an explicit deferral entry in the manifest. New practices can't quietly stay enforced-by-prose-only; the manifest forces an explicit classification.

## 6. Manifest maintenance protocol

When a new coding practice is documented:

1. Add a row to `inventory/coding-practice-coverage.json`.
2. Choose status: `lint-enforced` (with rule ref) / `tool-enforced` / `instruction-only` (with deferral note) / `model-judgment` (with rationale).
3. If `instruction-only`, file a follow-up ticket for the lint rule.
4. Run `node scripts/global/lint-coverage-metric.js` to confirm coverage stays ≥ 70%.

When a new lint rule ships:

1. Update the relevant manifest row from `instruction-only` to `lint-enforced` with rule ref.
2. Update or condense the instruction prose per §3a recommendations.
3. Re-run the metric.

## 7. Out of scope

- Actually editing the instruction files to apply §3a condensations — keep as a follow-up (cheap to skip; this PR satisfies AC4's audit-and-recommend goal).
- LLM eval harness for instruction-comprehension impact (separate concern).
- Deferred high/med Phase-1 children (1c, 1d, 1e, 1f, 1h) — follow-up tickets.

## 8. References

- Phase-0 design: [research/epic-1510-phase-0-design-2026-05-13.md](epic-1510-phase-0-design-2026-05-13.md)
- Bundle 1 PR: #1522 (three megalint validators)
- Manifest: `inventory/coding-practice-coverage.json`
- Metric script: `scripts/global/lint-coverage-metric.js`

---

Signed-by: Orla Harper
Team&Model: claude-code:opus-4-7@anthropic
Role: collaborator
