# Guardrail-First Anneal Routing — Phase-0 Design (#3381, Epic #3380)

## Thesis
Tier-2 anneal currently has one disposition that operators reach for by reflex — *write a memory note*.
A note is cheap to write and expensive forever: it is re-loaded every session (token tax), recalled by
embedding similarity (semantic≠causal → wrong-workaround thrash), and never fixes the defect. We add a
**deterministic router** in front of the Tier-2 disposition so that the *default* for a recurring,
deterministic friction is a **guardrail** (hook / validator / CI / test) that prevents the friction for
all four teams. Memory is retained only for genuine judgment/preference; one-offs decay.

## Q1 — Classification boundary (deterministic, fail-open to memory)
`classifyFriction(frictionRecord) -> {destination, confidence, signals[]}` over four destinations.
Inputs are the Tier-1 incident schema-v3 fields already emitted (`pattern_id`, `recurrence_7d`,
`severity`, `trigger_role`, `_summary`, optional `file`/`gate`/`marker`).

| Destination | Deterministic entry signals (ALL of a row) |
|---|---|
| **guardrail-candidate** | `recurrence_7d >= 2` AND `severity >= medium` AND signal names a **mechanical surface**: a gate/validator/hook/regex/state-file/CLI/label (`gate:`, `hook:`, `validator:`, `marker:`, or `_summary` matches the mechanical-lexicon set) AND outcome is reproducible (same inputs → same wrong output). |
| **skill** | recurring **multi-step correct procedure** (>=3 ordered tool steps) that is *not* a defect — the steps are right, they're just not yet reusable. Signal: `_summary` describes a sequence, no `gate:`/defect marker. |
| **semantic-memory** | **judgment / preference / external fact**: client directive, role boundary, model-choice taste, cost/latency tradeoff. Signal: `trigger_role==client` OR lexicon hits {prefers, directive, taste, boundary, choose, never ask}. **No mechanical surface.** |
| **forget** | `recurrence_7d < 2` AND one-off operational event (transient 401, dated session log). Decays per Q4. |

**Anti-over-route guard (the false-positive the rubric warns about):** a record is routed to
`guardrail-candidate` **only** when a mechanical surface is named *and* `judgment_lexicon` does NOT hit.
If both a mechanical surface and a judgment signal are present → route to **semantic-memory** and emit an
advisory (ambiguous; human/Consultant disposition). **Fail-open rule: unknown/low-confidence → semantic-memory**
(never silently convert a preference into a blocking guardrail). This makes false-erasure of legitimate
memory impossible by construction; the worst failure is an *un-promoted* note, which the recurrence counter
re-surfaces next time.

## Q2 — guardrail-candidate → mechanism sub-routing
`selectMechanism(frictionRecord) -> {mechanism, target_path, test_strategy}`:

| Friction shape | Mechanism | Why |
|---|---|---|
| Bad operator action reproducible **pre-execution** (write to canonical main, missing ticket ref, secret prompt) | **pretool hook** (`hooks/scripts/*.py` via `pretool_guard.py`) | prevention-first; blocks before damage (G1). |
| Malformed **artifact** the operator emits (baton comment, PR body, handoff field, label combo) | **megalint validator** (`scripts/global/megalint/*.js`) | deterministic parse gate at the artifact boundary. |
| Defect only observable **post-merge / in aggregate** (drift, sync regression, epic-closed-with-open-children) | **CI workflow** (`.github/workflows/*.yml`) backstop | catches what local hooks can't see across teams. |
| Pure-function / regex / parser collision (prose-collision, ordering, enum) | **unit/contract test** + the fix | locks the corrected behavior; cheapest. |

Default ladder (prevention-first, goal-lens order): **hook → validator → test → CI backstop**. A guardrail
ticket records the chosen rung and MUST ship a test (matrix: side-effect gates + adversarial parsers also
require `+stress-test`).

## Q3 — Poka-yoke: the memory-write guard
Interception at the **memory-write boundary**, not storage. A `PreToolUse` guard on `Write`/`Edit` whose
`file_path` is under the memory dir (`hooks/scripts/memory_write_guard.py`, registered in `pretool_guard.py`)
runs `classifyFriction` on the candidate note body:
- destination `semantic-memory` / `skill` → **allow** (genuine memory is frictionless).
- destination `guardrail-candidate` → **require a disposition line** in the note: `disposition: guardrail #<N>`
  (a filed guardrail ticket) OR `disposition: defer <reason>`. Missing → **deny with redirect**: "this is a
  deterministic-defect class; file a guardrail ticket (one command) or add `disposition: defer`."
- destination `forget` → advisory "this looks one-off; prefer incidents.jsonl".
Ships **advisory** first (emits the redirect as a warning, allows the write), promotes to **blocking** per Q6.
Escape hatch (never silent): `MEMORY_GUARD_BYPASS=1` emits an audit warning + allows.

## Q4 — Consolidation / forgetting policy
- **Recurrence counting** reuses the existing Tier-2 detector (`incidents.jsonl` `pattern_id` count in 7d) —
  no new counter. A note carries `pattern_id`; the guard reads the live count.
- **2nd recurrence rule:** on the 2nd in-window recurrence of a `guardrail-candidate` pattern, the router
  auto-files (or de-dupes onto) a guardrail ticket and links the note to it.
- **Retire-on-fix:** when the guardrail ticket closes `resolution:released`, a post-merge step deletes the
  originating note(s) and drops the MEMORY.md index line (the note's job is done — the guardrail now prevents
  recurrence). Audited; reversible (the deletion is itself a tracked diff).
- **Decay of one-offs:** `forget`-class records get budget-aware Priority-Decay in `incidents.jsonl`
  (bounded retention per `log-rotation.js`), never promoted to MEMORY.md.

## Q5 — Cross-team portability (G5)
All logic lives in `scripts/global/` (the single shared, runtime-agnostic surface mirrored to every team):
`friction-classifier.js` (pure), `mechanism-selector.js` (pure), consumed by each runtime's hook shim.
The Tier-2 contract text lives in `instructions/workflow-resilience.instructions.md` (already cross-team).
No per-team copy. Air-gapped/Tier-0 degrade: classifier is pure + local (no network); guard is local hook.
A guardrail authored from any team's friction prevents the friction for **all** teams because the artifact
is a shared hook/validator/CI gate, not a per-agent note.

## Q6 — Promotion gating (replay-eval, never calendar)
Both the classifier and the write-guard ship **advisory**. Promotion to **blocking** is gated on
`scripts/global/friction-classifier-replay-eval.js` reaching **precision >= 0.85** against a labeled corpus
`tests/fixtures/friction-corpus.json` (hand-labeled from historical MEMORY.md entries + incidents.jsonl).
`promotionEligible = precision >= 0.85`. Auto-revoking: if precision drops below 0.85 on corpus growth, it
reverts to advisory. **No N-day soak** — pure replay-eval per the harness's replay-over-calendar pattern.

## Q7 — De-confliction (overlap-decision)
| Epic | Relationship | Decision |
|---|---|---|
| **#3255** Guardrail for optimal ticket & Epic creation | adjacent: it guards *creation quality*; we guard *friction→disposition routing* | **gap** (no overlap) — different trigger surface. Reuse its guardrail-authoring patterns. |
| **#3251 / #3051** baton-back / merge guardrails | examples of the *target artifact* (a guardrail) we route friction toward | **overlap-as-precedent** — they are instances; we are the meta-router that produces more like them. |
| **#3126 / #3069** cross-model consensus optimization | we *consume* their consensus loop for Phase-0 + child validation | **dependency, not conflict** — reuse `cascade-dispatch`/free-cloud panel; do not re-implement. |
No conflict or redundancy; this Epic is the **routing layer** above existing point-guardrails.

## Proposed Phase-1 child set
1. `friction-classifier.js` + corpus + replay-eval (AC1, AC6).
2. `memory_write_guard.py` poka-yoke hook, advisory (AC2).
3. `workflow-resilience.instructions.md` Tier-2 contract update — guardrail-first routing + Q4 policy (AC3).
4. MEMORY.md audit/backfill tool: classify existing entries, emit guardrail-candidate tickets, dry-run forgetting pass (AC4).
5. `guardrail-conversion-rate` observability signal to dashboard (AC5).

## Performance & cost budget (G3 / G7)
The hot path adds **one pure, local classify call** per friction event (not per token, not per request) —
`classifyFriction` is string/regex over the already-emitted incident record, **p99 < 5 ms**, zero network,
zero LLM call. The memory-write guard fires only on a `Write`/`Edit` to the memory dir (a rare event), not on
normal tool use, so steady-state throughput (G7) is unaffected. Replay-eval and the consensus loop run
**off the hot path** (CI / on-demand), on the **free** fleet/free-cloud panel — zero paid tokens (G3).
Budget assertions are encoded as stress-test p99 gates per the test matrix (side-effect gate + adversarial
parser ⇒ `+stress-test`). Net token effect is **negative**: routing the deterministic-friction class out of
MEMORY.md shrinks the always-resident index, reducing per-session input tokens for every team.

## Privacy (G4)
The memory-write guard NEVER logs note content. The candidate note body is passed through
`scripts/global/log-redaction.js#redactString` before any classification telemetry or guardrail-ticket
summary is emitted; only the **destination + pattern_id + redacted one-line summary** leave the boundary —
never the raw note (which may carry a client directive or path). Guardrail tickets generated from a
`guardrail-candidate` carry the redacted summary, not the original note text. `forget`-class records decay
in `incidents.jsonl` under the existing redaction-on-write wrapper. No new secret surface is introduced.

## Observability (G8 / G9)
The `guardrail-conversion-rate` signal (schema-v3, `dashboard/events.jsonl`) is emitted with granular
dimensions so it is interoperable across all four teams (G9):
- `conversion_rate` = friction→guardrail / total recurring friction, broken down **per-team** and
  **per-mechanism** (hook / validator / CI / test).
- `classifier_precision` + **false-positive / false-negative** counts from the latest replay-eval run.
- `guard_latency_p99_ms` (the <5 ms budget above) and `note_index_token_footprint` (resident MEMORY.md size).
- `promotion_state` (advisory|blocking) per the Q6 replay-eval gate.
All fields use the shared `event-schema-v3.js` (`ts/version/service/env/event`) so any team's dashboard
reads them without an adapter (G9). A dissent-driven addition: emit `ambiguous_routed_to_memory` count so
the anti-over-route fail-open (Q1) is itself observable — we can see how often a mechanical+judgment
collision deferred to memory and audit those.

## Lexicon seed sets, deployment, and fail-open (G2 / G5 / G6 / G10)
**Mechanical lexicon (seed, → guardrail-candidate):** `gate`, `validator`, `hook`, `regex`, `enum`,
`label-lint`, `state-file`, `state.json`, `false-block`, `false-positive`, `misfire`, `collision`,
`ordering`, `prose-collision`, `merge-gate`, `push-gate`, `CI`, `workflow`, `schema`, `parser`, `marker`.
**Judgment lexicon (seed, → semantic-memory, wins on collision):** `prefers`, `preference`, `directive`,
`client`, `taste`, `boundary`, `choose`, `never ask`, `design`, `UAT`, `cost over`, `patience`, `wants`.
Both sets live in a versioned `config/friction-lexicon.json`; the classifier is pure and unit-tested with a
labeled corpus so the boundary is deterministic and reproducible (G2). Sets are data, not code — extendable
without a code change, audited via the corpus replay-eval.

**Cross-team deployment (G5):** the modules ship through the **existing** runtime-mirror pipeline —
`npm run deploy:apply` (Copilot + Codex mirrors) and `npm run deploy:claude:apply` (Claude Code), verified by
`npm run hamr:sync-verify`. Because `scripts/global/` is the mirrored source, one merge versions the same
classifier/guard for all four teams; there is no per-team divergence and no separate distribution channel.

**Fail-open & resilience (G6):** every failure mode degrades to the *safe, non-destructive* path —
`classifyFriction` returns `semantic-memory` on any exception/unknown (never a blocking guardrail); the
memory-write guard **allows** the write if the classifier throws or times out (advisory > availability). A
`tests/stress-friction-guard.spec.js` chaos/fault-injection spec asserts: classifier-throws → note allowed;
corrupt incident record → `forget`; classifier-timeout → allow + advisory. This makes the guard incapable of
*blocking legitimate work* even when its own dependencies fail.

**Guardrail lifecycle / deprecation (G10):** a guardrail is **retired** (not kept forever) when its friction
class goes extinct — replay-eval shows zero incidents for that `pattern_id` across the full corpus *and* the
guardrail has fired zero true-positives since promotion. Retirement is replay-eval-gated (corpus-extinction),
never calendar-gated, mirroring the Q6 promotion model in reverse. The retire-on-fix note-deletion (Q4) and
this guardrail-retirement together keep both memory *and* the guardrail set from accreting dead weight.

## Goal-lens self-assessment
G1 prevention-first guardrails; G2 deterministic > embedding-recall; G3 entire path free (fleet/free-cloud),
smaller resident index; G4 no secrets in notes; G5 shared module, Tier-0 degrade; G6 one fix protects all teams;
G8 conversion-rate signal; G10 one canonical fix replaces N drifting notes. min(G1..G10) target >= 7.
