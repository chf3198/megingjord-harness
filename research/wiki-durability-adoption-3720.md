---
title: "Durably-upkept, human-browsable LLM Wiki — Phase-0 design-of-record"
ticket: 3720
epic: 3719
status: ratified
lane: docs-research
test_strategy: peer-review
created: "2026-07-12"
updated: "2026-07-12"
content_trust_score: 1.0
cross_family_receipts:
  - "a61635663af8af42"   # design-deconfliction (#3719 vs #3724) — PASS meta+mistral
  - "c9e7ba9de83fc6ec"   # design-retrieval (zero-cost floor + gated embeddings) — PASS meta+mistral
consumes:
  - "3725"               # ratified memory Phase-0 (AC-R7 write-path receipt a98ea71552de23b6)
---

# Phase-0 Design-of-Record — Durably-upkept, human-browsable LLM Wiki (Epic #3719)

> The single blocking Phase-0 R&P gate (#3720) for Epic #3719. Scope is **EVOLVE, not rebuild** on
> the existing three-wiki substrate (cross-family panel `70c594dfb463675f`, PASS). This document is the
> design-of-record a Phase-1 implementer executes without re-deciding anything, plus the phased
> dev→test iterative-proof plan with measurable, **replay-eval-gated (not calendar)** exit criteria.
>
> Grounded in a read-only audit of the live tree on 2026-07-12 (file counts, workflow-run history,
> validator source, retrieval source). Every "as-is" claim below is measured, not assumed.

## 0. Deconfliction (the redundancy/conflict this gate remediates) — cross-family PASS `a61635663af8af42`

Two research-first Epics touch the wiki: **#3719** (this one — durable wiki upkeep + adoption + human
surface) and **#3724** (memory-mechanism redesign umbrella). #3724's Phase-0 (#3725, merged PR #3726) is
**done and ratified**; its AC-R7 (`research/mem-ac-r7-write-path-3725.md`, receipt `a98ea71552de23b6`)
**already decided the wiki write-path**: a dedicated **non-protected `wiki-mirror` branch** (Option b),
`main` branch-protection untouched, bypass-actor explicitly **out** as a client-only G4 carve-out. #3724
defers *upkeep execution* to #3719; its Phase-1 child **#3729** (+ bug **#3723**) already **owns** the
mirror-cutover execution.

**Resolution (ratified, cross-family PASS `a61635663af8af42`, meta + mistral, authoring family
anthropic excluded):**

1. #3719 **consumes** #3724's ratified AC-R7 write-path decision. It does **not** re-derive or duplicate
   the mirror-branch cutover. Execution of the cutover stays with **#3729 / #3723** (cross-referenced,
   **not** re-parented; no branch-protection change).
2. #3719's Phase-1 narrows to the **complementary** slices #3724 deferred, listed in §8.
3. Memory-system evaluation stays owned by **#3730**; #3719 **reuses** that harness — no parallel eval.
4. No wiki intent is orphaned: consolidation dispositions for #2093 / #3157 / #2508 / #743 are in §7.

This is a clean **design → execution** boundary. No wiki-durability code has shipped yet (no remote
branch, no open PR, both #3723 and #3729 at `status:backlog`, mirrors still frozen), so the boundary is
drawn before any effort is spent twice.

## 1. R1 — Post-mortem: why every prior wiki generation rotted

Lineage traced: `#22` → `#866` (Karpathy quality/retrieval) → `#1625/#1626` (critical-analysis +
hardening) → `#1942/#1943` (three-wiki typology + auto-update) → `#3063` ("Restore continuous
auto-update" — i.e. it had already rotted). Root-cause taxonomy (each generation shipped
`resolution:released/completed`, then silently decayed):

| Failure mode | Evidence in the live tree (2026-07-12) |
|---|---|
| **Unmonitored-CI-decay** | `wiki-reconcile-cron` has had **zero successful runs**; failures on 07-09/10/11/12 all `failure`. Wiki B frozen: 2131/2138 work-log mirrors still stamped `updated: 2026-06-17`. |
| **Alarm-can't-fire (self-silencing)** | #3718's original bug staged a **gitignored** path (`dashboard/events.jsonl`) in `git add`; under `bash -e` the add aborted the whole commit → froze the mirror **and** the health signal wrote to the same gitignored path. |
| **Schema-drift-tolerated** | Documented contract (`wiki_type`/`freshness_window`) carried by **4 / 2843** pages; validator actually enforces `type`/`updated`. Divergence logged at #3068 as "memory-note-only, out of scope" — never fixed. |
| **Retrieval-not-wired** | 5+ retrieval scripts exist but agents do not demonstrably consume them in baton workflows (#2093 open). |
| **Advisory-forever-gates** | `wiki-drift-gate-advisory` + `wiki-lint-gate` never promoted past advisory; the replay-eval precision bar was never reached, so nothing blocks decay. |
| **No-human-surface** | A dashboard page-list + health reader exists, but no browse/search UI; humans never adopt/curate, so the wiki stays write-only. |

**Thesis confirmed:** the substrate is sound (523 code / 2138 work-log / 176 wisdom pages; ~37 scripts;
a real validator, retrieval router, replay-eval harness). The gap is **durability of upkeep + adoption +
sustained proof**, exactly as the Epic states. A sixth rebuild would repeat the pattern.

**Correction to the Epic's own framing (drift remediated here):** #3718 is **DONE** and its failure-alarm
**works** (it filed **#3722**), yet the freeze **persists for a new cause** — the reconcile commit now
aborts on a lefthook `lint-py` / `lint-line-cap` pre-commit hook that fires because the CI job runs
`npm ci` (installing lefthook) before committing. So "fix #3718 first, then durability generalizes it" is
stale: the generalization is R2 below, and the specific wall is cleared by the #3723/#3729 mirror-branch
cutover — **not** by re-touching #3718.

## 2. R2 — Self-verifying, self-alerting upkeep loop (owned by #3719)

Design requirements for a reconcile loop that **survives its own bugs**:

- **Idempotent + partial-failure-tolerant.** One bad path (a gitignored add, a single unparseable page,
  one lint failure) must not abort the whole run. Reconcile iterates per-page with per-item error capture
  and a run-summary; a bad item is skipped-and-reported, never fatal to the batch.
- **Runs where dev gates do not.** The mirror/reconcile automation commits from CI; developer
  `pre-commit`/`pre-push` lefthook suites (`lint-py`, `lint-line-cap`) must **not** run on the bot's
  commit. This is the current freeze cause. The cutover to the non-protected `wiki-mirror` branch
  (#3729, using AC-R7 Option b + `--no-verify` per #3723 AC1) is the mechanism; #3719 does **not**
  duplicate it — it **depends** on it and verifies the outcome.
- **Failure is loud, not silent.** Every `wiki-*` CI failure must surface a Tier-1/Tier-2 signal to a
  **non-gitignored** sink. The #3718 fix already added a deduped `if: failure()` GitHub-issue alert
  (proven — it filed #3722). R2 generalizes this to **all** `wiki-*` workflows and adds a **liveness
  SLO**: "≥1 successful reconcile per 24h" emitted to a committed events path, with the detector unable to
  write to a gitignored path (root-cause of the original self-silencing).
- **Promotion path advisory → required.** The drift-gate and lint-gate promote to **required** only after
  the replay-eval precision bar (§4) is met on a committed labeled corpus; until then they stay advisory
  but the **liveness SLO** is required immediately (it has no precision dependency).

**Exit criterion:** work-log/code coverage ≥ 0.95 and staleness ≤ 0.10 **held across N consecutive
reconcile cycles** (N defined in §9), with any `wiki-*` failure self-alerting to a committed sink.

## 3. R3 — Two-scope model (global + workspace)

Confirm/refine the existing split (measured as real in the #3725 privacy audit, AC-R5):

- **Global** — `wiki/wisdom/global/`, distributed read-only to `~/.copilot/wiki/`, reachable from every
  project on the machine. Human-readable in both the repo and the mirror.
- **Workspace-specific** — `wiki/wisdom/project/` (**A4-isolated: never distributed**) + the code/work-log
  wikis, per-repo. Portable to the **Tier-0 local floor** (plain files + grep, no network).

The multi-repo write path (revisit #743) is **folded** (§7): the `wiki-mirror` branch model (#3729) is the
write path; #743's broader multi-repo ambition is recorded as a cross-ref, not reopened in Phase-1.
Privacy invariants (G4 hard constraint) are **unchanged**: `log-redaction.js` prevent-at-write, A4
isolation, write-router `private` flag. #3719 may not weaken them.

## 4. R4 — Retrieval + agent-plaintext, wired in — cross-family PASS `c9e7ba9de83fc6ec`

**As-is (measured):** wiki retrieval is **lexical-only** — `retrieval-router.js` routes query-class →
wiki-type, then `retrieval-rank.js` ranks with BM25 + a token-overlap "dense" scorer (Jaccard-style set
overlap over a `/[a-z0-9]{2,}/` tokenizer) + RRF fusion. **No embeddings.** `read-router.js` states
embeddings/graph are "DEFERRED (replay-eval-gated)". The only embedding code (`fleet-rag-local.js`, #2856)
is fleet-context RAG that degrades to wiki-search and does **not** touch the wiki path.

**Correction (drift remediated):** the cited **"0.12 precision FAIL" baseline is not persisted anywhere**
in the tree (`eval-harness.js` computes precision@5 vs `eval-ground-truth.json`; the promotion floor is
`0.85`). R4 must **re-baseline**, not assume 0.12.

**Ratified retrieval architecture (cross-family PASS `c9e7ba9de83fc6ec`, meta + mistral):**

1. **Mandatory Tier-0 floor:** keep the portable, `$0`, air-gapped **lexical index (BM25 + RRF)** as the
   default that always works — no network, no model. This is the G3/G5 floor.
2. **Optional acceleration:** add a **local/free embedding index** (fleet/Ollama or a small local vector
   store) **only** as optional acceleration, promoted **only** after it clears a labeled-query
   precision/recall **replay-eval gate**. Graceful degradation to lexical when absent.
3. **No hosted/paid vector DB** — ever, under G3.
4. **Agent-plaintext path stays the consumption default.** Wire retrieval into **≥1 real baton/Consultant
   workflow** (the Consultant pre-critique wiki lookup is the first target) with a **measured token-cost
   reduction** vs no-retrieval — this is how #2093's wiki-adoption sub-intent lands (see §7).
5. **Re-baseline + corpus:** build a committed labeled query corpus and re-measure precision@k / recall as
   the true baseline; the gate target (≥ floor) is met on that corpus before any promotion.
6. **Eval reuse:** the retrieval-quality eval **reuses #3730's memory-eval harness** (no parallel eval),
   folding **#3157** (RAG token-reduction benchmark) as the token-cost half of that suite.

## 5. R5 — Human browser surface

**As-is:** a dashboard-based wiki **page-list + health/metrics reader** already exists
(`dashboard/index.html`, `scripts/wiki-pages-api.js`, `scripts/dashboard-wiki.js`,
`dashboard/css/wiki.css`). Search is CLI-only (`npm run wiki:search`).

**Design:** **enhance the existing dashboard** (do not greenfield, do not build a marketplace extension)
into a browsable + **searchable** reader over both scopes (global + workspace), backed by the same
lexical retrieval floor (R4), plus a **low-friction curation path** (edit/flag-stale from the reader that
writes through the normal validated write path). Decision: **dashboard-panel**, not standalone app, not
extension — this is the minimal-surface, `$0`, portable choice and reuses the shipped reader. #2508
(marketplace extension Epic) is **cross-referenced, not superseded/closed** (§7).

## 6. R6 — Schema reconciliation → required gate

**As-is (measured):** the Ajv validator (`config/wiki-frontmatter.schema.json` via
`validate-frontmatter.js`) requires `["title","type","content_trust_score","created","updated"]` with
`type ∈ {code, work-log, wisdom-global, wisdom-project}`. The **instructions** claim `wiki_type` /
`freshness_window` are required — carried by **4 / 2843** pages. `content_hash` (2137) and `last_updated`
(2663) are shipped-but-not-required.

**Design:** the **validator is source-of-truth**. R6 (a) reconciles the *instructions* to the validator
(`type`/`updated`, not `wiki_type`/`freshness_window`), (b) decides the disposition of the extra shipped
fields (`content_hash`, `last_updated`) — keep as validated-optional or promote to required — as a Phase-1
child, and (c) **promotes the frontmatter validator from advisory to a required PR gate** once the corpus
is clean (so divergence cannot re-accrue). Note: `freshness_window` is being retired by #3724's #3731
(temporal `valid_from`/`valid_to`); R6 coordinates so the two do not fight over the same field.

## 7. R7 — Consolidation disposition (no orphaned wiki intent)

| Item | Nature | Disposition |
|---|---|---|
| **#3718** | reconcile gitignore bug | **DONE** — closed; alarm proven (filed #3722). Generalized by R2, not reopened. |
| **#3722** | live freeze alarm (lint-gate abort) | **Cross-ref** — the alarm working is evidence; the fix is the #3723/#3729 cutover. |
| **#3723** | mirror write-path bug (`--no-verify` + wiki-mirror) | **Execution owner (external)** — stays under #3724 lineage; #3719 depends on + verifies it. Not re-parented. |
| **#3729** | Wiki B mirror-branch cutover | **Execution owner (external)** — #3724 Phase-1 child; #3719 does not duplicate. |
| **#2093** | red-team Consultant uses wiki/tools (Epic) | **Cross-ref, do NOT close.** #3719 addresses only its wiki-retrieval-adoption sub-intent (R4 item 4). |
| **#3157** | RAG token-reduction benchmark | **Fold** into R4's eval (the token-cost half of #3730's harness). Close on Phase-1 landing. |
| **#2508** | Marketplace extension (Epic) | **Cross-ref, do NOT close.** #3719's human surface enhances the dashboard (R5); the marketplace Epic is orthogonal. |
| **#743** | multi-repo write path | **Cross-ref.** Superseded in practice by the `wiki-mirror` model (#3729); not reopened. |

**Drift remediated:** the Epic body's "retire #2093 / supersede #2508" over-claims — both are broader
Epics and are **not** closed by #3719. Only the wiki sub-intent is addressed, via cross-reference.

## 8. Phase-1 decomposition (just-in-time; each child cites `Refs #3720`)

Sequenced, complementary to the #3729/#3723 mirror-cutover (which #3719 depends on but does not own):

- **P1-a — Self-alerting reconcile liveness SLO (R2).** Generalize the #3718 failure-alert to all
  `wiki-*` workflows; add a committed-sink liveness SLO ("≥1 successful reconcile / 24h"); make liveness a
  **required** signal. Depends on #3729 (a green reconcile must be possible first). `P1`.
- **P1-b — Retrieval re-baseline + labeled corpus (R4).** Build/commit the labeled query corpus; re-measure
  precision@k / recall on the lexical floor as the true baseline; wire the eval into #3730's harness; fold
  #3157. `P1`.
- **P1-c — Retrieval wired into ≥1 baton workflow + token-cost proof (R4).** Wire wiki retrieval into the
  Consultant pre-critique lookup; measure token-cost reduction; addresses #2093's wiki sub-intent. `P2`.
- **P1-d — Optional local/free embedding acceleration, replay-eval-gated (R4).** Add the local embedding
  index behind the precision/recall gate; graceful degradation to lexical. `P2`.
- **P1-e — Schema reconciliation + required validator gate (R6).** Reconcile instructions↔validator;
  decide extra-field disposition; promote the validator to required; coordinate with #3731 on
  `freshness_window`. `P1`.
- **P1-f — Human browse/search + curation surface (R5).** Enhance the dashboard reader into a searchable
  browser over both scopes + low-friction curation through the validated write path. `P2`.
- **P1-g — Drift/lint gate advisory→required promotion + sustained-proof harness (R2/§9).** The dev→test
  loop that proves the metrics **hold** across N cycles before Epic close. `P1`.

## 9. Measurable Epic exit criteria (replay-eval-gated, NOT calendar)

The Epic #3719 closes only when a **dev→test iterative-proof** loop shows these **hold** (not one-shot):

1. **Upkeep:** work-log + code coverage ≥ **0.95** and staleness ≤ **0.10**, sustained across **N = 5**
   consecutive reconcile cycles with zero silent failures (every failure self-alerted).
2. **Liveness:** "≥1 successful reconcile / 24h" is a **required** signal for ≥ N cycles.
3. **Retrieval:** precision/recall **≥ the committed floor** on the labeled corpus (floor re-baselined in
   P1-b; not the mythical 0.12), and retrieval **wired into ≥1 baton workflow with a measured token-cost
   reduction**.
4. **Schema:** validator == instructions == shipped frontmatter; the validator is a **required** gate.
5. **Human surface:** a browsable + searchable dashboard reader shipped and demonstrably used (≥1 curation
   action through it).
6. **Proof:** all of the above demonstrated to **hold** across the N-cycle replay-eval window (Epic
   #1771/#1827 promotion model), not asserted once.

`N = 5` reconcile cycles is a **replay-eval count**, deliberately not a wall-clock calendar window, per the
harness anti-calendar-cadence guardrail (#2983).

## 10. Method / gates

- `test_strategy: peer-review` (docs-research lane); design decisions via **free cross-family panels**
  (`scripts/global/cross-family-consensus.js`, ≥2 non-authoring families, `$0`) — receipts
  `a61635663af8af42` (deconfliction) and `c9e7ba9de83fc6ec` (retrieval); consumes `a98ea71552de23b6`
  (#3725 AC-R7 write-path).
- Research-first phase-gate rules apply (`instructions/epic-governance.instructions.md`). Close with
  `verdict: approve_for_merge`, rubric `min(G1..G9) ≥ 7`.
- G1 Governance (phase-gate; **no** branch-protection weakening) and G3 Zero Cost are hard/primary; G5
  Portability (Tier-0 floor), G2 Quality, G4 Privacy (A4 isolation preserved), G10 Maintainability follow.

Refs Epic #3719 · Refs #3718 #3722 #3723 #3729 #3730 #3157 #2093 #2508 #743 · Consumes #3725
