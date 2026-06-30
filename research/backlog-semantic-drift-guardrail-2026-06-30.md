# Phase-0 Research — Pre-Baton Backlog Semantic-Drift + Inbound-Orphan Guardrail

> **Ticket:** #3399 (Phase-0 of research-first Epic #3398)
> **Date:** 2026-06-30 · **Lane:** `lane:docs-research` · **Strategy:** `peer-review`
> **Author role:** Collaborator (analyst) · **Signed-by:** Orla Harper · **Team&Model:** claude-code:opus@local

## 0. Problem in one diagram

The harness has a structural authority gap: a ticket that **never enters the baton** is
**never reviewed by any role**, so semantic drift (the goal got satisfied elsewhere) and
inbound-reference orphans (someone points *at* this ticket) accrue invisibly until a human
prompts a manual audit.

```mermaid
flowchart TD
    A[Ticket created → status:backlog] --> B{Enters active baton?}
    B -- "Yes: triage→…→review" --> C[Consultant reviews at status:review]
    C --> D[Drift caught + anneal tickets filed]
    B -- "No: dormant in backlog" --> E[No role ever reviews it]
    E --> F[World moves on: capability ships piecemeal elsewhere]
    F --> G[Semantic supersession accrues, invisible]
    G --> H[Human must prompt a manual premium-lane audit]
    H --> I[Cancel ticket]
    I --> J{Inbound refs checked?}
    J -- "No guardrail today" --> K[Dangling merge-into-#N pointers orphaned]
    style E fill:#ffd6d6
    style G fill:#ffd6d6
    style H fill:#ffd6d6
    style K fill:#ffd6d6
```

**Concrete recurrence (this is ≥2-in-window → Tier-2 anneal, not a one-off):** Epic #1899 sat
`status:backlog` ~6 weeks while its scoped capability shipped through `role-red-team-critique`,
`cross-family-review`/#2511, the Red-Team Reviewer agent, `fleet-review-required.js`/#2192, and
`megalint/*` validators. Cancelling it orphaned the inbound "merge into #1899" pointers on #2093
and #3069 (inbound-mention to 1899 on #2093 verified live). Manual premium-lane backlog audits
recurred 2026-06-12 (#2981), 06-27, 06-29, and 06-30 — each doing work a guardrail should own.

---

## 1. AC-R1 — Pre-baton drift-class taxonomy

Four classes, each tagged by the **minimum machinery** needed to detect it. "Deterministic"
means structural signals already available to a $0 string/graph pass; "needs-cross-model" means
the verdict requires natural-language judgment ("is goal X satisfied by artifacts Y,Z?").

| # | Class | What it is | Detection | This-session example |
|---|---|---|---|---|
| **PB1** | **Semantic supersession** | A dormant backlog ticket's goal is already satisfied by shipped artifacts under *other* tickets. | **needs-cross-model** (the "is it the same goal?" judgment is NL; the candidate-set filter is deterministic) | #1899 superseded by red-team skills + #2192 gate + megalint |
| **PB2** | **Inbound-orphan** | A ticket is referenced as a survivor / merge-target / dependency by *other* live items; closing/cancelling it dangles those pointers. | **deterministic** (regex over inbound bodies/comments at close-time) | "merge into #1899" on #2093 / #3069 dangled on cancel |
| **PB3** | **Stale research-first** | A `phase-gate:research-first` Epic whose Phase-0 children are all closed but Phase-1 never authored, OR whose research premise is overtaken by events. | **hybrid**: zero-Phase-1 is deterministic (already #2678); *premise-overtaken* is needs-cross-model | (guards against the #2661 silent-close class re-manifesting semantically) |
| **PB4** | **Dependency-rot** | A backlog ticket `blocked by #N` where #N is already closed/cancelled (block cleared, nobody re-triaged), or depends on a deleted/renamed artifact. | **deterministic** (resolve `blocked by #N` → check #N terminal state) | dangling `blocked by` survives close events today |

**Why this set and not more:** PB1/PB2 are the two classes with live this-session casualties and are
the Epic's named slice. PB3/PB4 are included because the same dormant-backlog scan surface detects
them for near-zero marginal cost (PB4 fully deterministic, PB3's deterministic half already partly
shipped in #2678) — but **only PB1 (and PB3-premise) actually require the paid-risk cross-model lane**;
PB2/PB4 stay $0. This keeps the cross-model budget minimal (G3).

```mermaid
flowchart LR
    subgraph "$0 deterministic (extends #2981)"
      PB2[PB2 inbound-orphan]
      PB4[PB4 dependency-rot]
      PB3d[PB3 zero-Phase-1<br/>already #2678]
    end
    subgraph "needs cross-model (fleet-first $0)"
      PB1[PB1 semantic supersession]
      PB3s[PB3 premise-overtaken]
    end
```

---

## 2. AC-R2 — Relevance-pass siting decision + cost model

### Decision: **extend #2981 `governance-drift-sweep.js` with an opt-in cross-model lane**, dispatched on a **scheduled routine**; do NOT build a parallel skill.

Three candidate sites were weighed:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. New standalone skill** | clean separation | duplicates the ticket-list + label-parse + report scaffold `governance-drift-sweep.js` already owns; two drift surfaces drift apart (the irony) | ✗ rejected (G10) |
| **B. Extend #2981 sweeper, opt-in lane** | reuses `listOpenTickets` + `classifyIssue` + report writer; one drift surface; deterministic classes stay $0, cross-model is a flag | must keep the cross-model lane strictly opt-in so the default `--scan` stays $0 | ✓ **chosen** |
| **C. Active-baton hook (#3235 path)** | reuses Consultant CI | wrong jurisdiction — pre-baton tickets never reach the active-baton gate | ✗ rejected (the gap itself) |

**Siting detail.** `governance-drift-sweep.js#classifyIssue` already emits structural classes
`D1..D8` over `listOpenTickets()`, including `D5` (backlog child of an active Epic) and `D6`
(dormant Epic w/o `EPIC_REVIEW`). The candidate filter for PB1 is *exactly* the dormant-backlog
subset this function already isolates. Add:
- a deterministic `D9` (PB2 inbound-orphan) and `D10` (PB4 dependency-rot) to the default $0 scan;
- an **opt-in `--semantic` flag** that, for the dormant-backlog candidate set only, dispatches a
  cross-model relevance verdict and emits `PB1`/`PB3s` flags. Default `--scan` never calls a model.

### Cost model — fleet-first $0 (hard constraint)

```mermaid
flowchart TD
    S[--semantic lane] --> F{Fleet reachable?<br/>qwen-32b @ 100.91.113.16}
    F -- yes --> FL[Fleet qwen3:32b verdict<br/>$0]
    F -- "no (availability)" --> FC[Free-cloud panel<br/>Groq/Cerebras/Mistral $0]
    FL --> AGG[median-of-N consensus]
    FC --> AGG
    AGG --> OUT[flag + evidence + score]
```

- **Primary:** fleet `qwen3:32b` / `qwen2.5-coder:32b` on `100.91.113.16:11434` — **$0**, already the
  high-stakes rater per project practice.
- **Availability failover:** fleet down → **free-cloud $0 panel** (Groq-llama, Cerebras, Mistral) via
  `free-cloud-dispatch.js`, per the #2619/#2621 cost-ascending mandate. **Never** steps to paid Haiku
  on a fleet *availability* outage.
- **Budget envelope:** candidate set = dormant backlog only (tens of tickets, not thousands). One
  verdict per candidate per run, scheduled (e.g. weekly cron), median-of-N for the numeric noise
  (per `consensus_rater_noise_aggregation`). Estimated paid-$ avoided vs. the recurring premium-lane
  human audit it replaces is the G3 win — logged like `free-cloud-usage-report.js` does.

#### Embedding pre-filter — cheap candidate ranking before any cross-model verdict

Grounded in duplicate-bug-report SOTA (siamese/triplet semantic-embedding nets; LLM-embedding
recall@k 68–74%; the `GitBugs` benchmark and `Cupid`/ChatGPT-assisted dedup — §9), PB1 does **not**
spend a cross-model verdict on every dormant ticket. It first ranks the candidate set by **embedding
cosine similarity** between the ticket's goal text and the descriptions of recently-shipped artifacts
(closed PRs / merged skills / new gates). Only the top-similarity shortlist — likely-superseded by an
embedding signal — escalates to the (more expensive) cross-model relevance verdict. Embedding compare
is ~$0 and local, so it sharply bounds cross-model call volume (G3/G7) — the same "embed into a
low-dimensional space, then judge" pattern the dedup literature established.

#### G7 Throughput — scalability bound (candidate-set is the lever)

The cross-model cost is **not** O(all backlog). Only PB1/PB3s (the needs-cross-model classes) ever
call a model, and only over the **dormant-backlog subset** the #2981 classifier already isolates
(D5/D6) — PB2/PB4 are deterministic $0 and carry the structural majority. For a backlog that grows
unexpectedly large, the sweep applies (a) a per-run candidate **cap** (`--max-candidates N`, oldest-
first), (b) **content-hash memoization** so an unchanged dormant ticket is not re-rated until its body
or the shipped-artifact set changes, and (c) batched dispatch. So per-run model calls stay bounded by
the cap, not by total backlog size — the median-of-N panel never becomes the bottleneck.

#### G4 Privacy — redaction before dispatch (mandatory)

Every candidate's text (title + body only — never diffs, tokens, or secrets) is passed through
`scripts/global/log-redaction.js#redactString` (Anthropic/OpenAI keys, GitHub PAT, JWT, email, IPv4
patterns) **before** any fleet or free-cloud dispatch. The dispatch payload is the redacted goal
statement + the shipped-artifact identifiers, not raw ticket internals. This is a hard precondition of
the `--semantic` lane, not an afterthought.

#### G5 Portability / G6 Resilience — tier-graceful degradation (no hard fail)

Substrate availability is not assumed. The lane degrades, never crashes: fleet down →
free-cloud $0 panel → **if ALL model substrates are unavailable or blocked, the semantic lane
silently degrades to deterministic-only** (PB2/PB4 still run at $0; PB1/PB3s simply emit no new flags
that run). Evidence this is real, not hypothetical: **this session's own consensus run hit a live
`groq` Cloudflare-1010 UA block and free-tier TPM limits** — the fleet local path was the resilient
fallback. No single vendor (or the fleet host) is a hard dependency; the deterministic floor always
remains.

### 2.1 Candidate-filter validation (the D5/D6 subset is an assumption — audit it)

Using the #2981 D5/D6 dormant subset as the PB1 candidate filter is an **assumption**, not a proof: a
ticket mis-labeled `status:in-progress` (stale), or whose parentage is mis-asserted, would be a **false
negative** — a genuinely-dormant superseded ticket the sweep never examines. C1 therefore ships a
filter-recall audit:

1. **False-negative probe (deterministic):** `listOpenTickets()` filtered to `status:backlog`/`status:queued`
   tickets **not** captured by D5/D6, plus tickets whose last activity (`updatedAt`) exceeds a dormancy
   window — the candidate-leak set.
2. **Recall target:** `D5/D6 filter recall ≥ 0.95` against a manual audit of a 20-ticket sample from the
   leak set (is each truly active, or a mislabeled dormant?). Below target → widen the filter, don't ship.
3. **Override:** a `--force-scan` flag bypasses the D5/D6 filter and rates the full open-backlog set
   (bounded by the §2 candidate cap) for the rare audit where the filter itself is suspect.

**Dormancy signal — velocity-relative, NOT calendar (counsel R1, adapted).** Two experts recommended a
fixed "no updates for 30+ days" dormancy threshold to catch mislabeled-but-stale tickets (e.g. a stale
`status:in-progress`). The *intent* is right — a label-independent activity signal hardens the candidate
filter — but a hardcoded N-day threshold is the calendar-threshold anti-pattern this harness explicitly
rejects (velocity changes; 30 days means different things in a busy vs. quiet week). So the dormancy
signal is **activity-rank-relative**: a ticket is "dormant" if its `updatedAt` falls in the bottom
quantile of *currently-open* tickets' recency (e.g. least-recently-touched quintile), recomputed each
run — no absolute day count. This catches stale-labelled tickets the D5/D6 label filter misses, while
staying velocity-relative per the replay-eval-over-calendar discipline.

This makes the candidate set falsifiable rather than assumed-exhaustive.

---

## 3. AC-R3 — Inbound-reference integrity check

### Reference-form catalog (what to scan for, in *other* live items, pointing at the closing ticket #N)

| Form | Regex sketch | Semantics | Auto-correction |
|---|---|---|---|
| `merge into #N` / `merged into #N` / `fold into #N` | `/(?:merge[d]?\|fold)\s+into\s+#N\b/i` | #N was the designated survivor of a merge | re-route the pointer to #N's actual successor, or flag for re-home |
| `blocked by #N` / `blocks #N` | `/block(?:ed\|s)?\s+(?:by\s+)?#N\b/i` | dependency edge | if #N cancelled, the block is void → re-triage the blocked item |
| `survivor: #N` / `canonical: #N` / `supersedes #N` | `/(?:survivor\|canonical\|supersed\w+)[:\s]+#N\b/i` | designation note | designation invalidated → file correction |
| `Refs Epic #N` / `Parent: #N` (child-side) | existing close-readiness regexes | structural parentage | re-home children before close (overlaps #3350 outbound, see §4) |

### Hook point: the `issues.closed` Action — a sibling to `epic-close-readiness-check.js`

`epic-close-readiness-check.js` already fires on `issues.closed` and validates **outbound** edges
(are my children terminal?). It does **zero inbound** scanning. The inbound check is a structurally
identical sibling that, on the same event, runs an inbound scan: *"who points at the ticket being
closed, and is that pointer now dangling?"* This is the **existence-dependency** relation from current
knowledge-graph work (§9) — a `merge into #N` note is an edge asserting the pointer cannot validly
exist without #N surviving; reference-rot studies put dangling/orphaned references at ~23% (≈50% with
content drift), so this is a measurable, recurring class — not an edge case.

```mermaid
sequenceDiagram
    participant U as Cancel/close #N
    participant CR as epic-close-readiness (OUTBOUND, #3350)
    participant IB as inbound-reference-integrity (NEW, this Epic)
    U->>CR: issues.closed
    CR-->>U: children-terminal? (existing)
    U->>IB: issues.closed
    IB->>IB: scan open issues' bodies/comments for #N references
    alt dangling pointer found
        IB->>IB: auto-file correction task (Manager-triage seed)
        IB-->>U: BLOCKER_NOTE comment naming each orphaned pointer
    else clean
        IB-->>U: pass
    end
```

### Auto-correction-task spec
On a dangling-pointer hit, emit a **Manager-triage seed** ticket (not report-only):
`title: "Re-home orphaned reference to #N from #M"`, body cites each `#M` + the exact reference
line, labels `type:task` `status:backlog` `area:governance` `anneal:tier-2`, and a schema-v3
`incidents.jsonl` event `pattern_id: inbound-reference-orphan`. This satisfies Epic AC2 + AC3
(detection routes into the baton).

---

## 4. AC-R4 — Consultant-authority extension, reconciled with #3235 and #2981

The structural authority gap: the Consultant baton is **per-ticket, at `status:review` only**.
Dormant backlog tickets never reach review → Consultant has **no jurisdiction**. Two reconciliation
constraints:

```mermaid
flowchart LR
    subgraph PRE["PRE-BATON (this Epic #3398)"]
      direction TB
      P1["semantic relevance sweep<br/>over DORMANT backlog"]
      P2["inbound-orphan check<br/>at close/cancel"]
    end
    subgraph STRUCT["#2981 deterministic sweep"]
      direction TB
      S1["D1..D8 structural classes<br/>$0, no NL reasoning"]
    end
    subgraph ACTIVE["#3235 Consultant-CI"]
      direction TB
      A1["Consultant rigor on ACTIVE<br/>lane:code-change at merge"]
    end
    STRUCT -- "this Epic adds the SEMANTIC layer it excludes" --> PRE
    PRE -- "feeds flagged items INTO the baton, where" --> ACTIVE
```

- **vs. #2981 (deterministic structural sweep):** #2981 explicitly excludes NL reasoning. This Epic
  is the **semantic layer above it** — same sweeper host (§2), new opt-in lane. No duplication.
- **vs. #3235 (active-baton Consultant-CI):** #3235 applies Consultant rigor to **active**
  `lane:code-change` batons at merge. This Epic is the **pre-baton complement**: it does not review
  active batons; it *creates* baton items (triage seeds) from pre-baton drift, which #3235 then
  governs normally once they enter the active flow. Boundary is clean: #3235 = in-baton, #3398 = pre-baton.

**Authority model (no new role):** the periodic semantic sweep is **Consultant-delegated automation**,
not a new human/role. It produces *advisory flags with cited evidence*; a flag becoming an actual
cancel of a P1/Epic item requires the §5 safety gate. Routine reversible flags (file a re-triage
task) need no human — they route to Manager via the standard Tier-2 anneal path. This respects the
operator-identity contract (client = design/UAT only; routine dev decisions → fleet oracle).

---

## 5. AC-R5 — False-supersede safety model

**Axiom: a wrong cancel is worse than a missed flag.** Detection is cheap and reversible; an
erroneous cancel of live work is expensive and (for the ticket's momentum) destructive. The model
is therefore asymmetric — easy to *flag*, hard to *irreversibly act*.

```mermaid
flowchart TD
    F[PB1 semantic-supersession flag] --> EB{Evidence-bound?<br/>cites shipped artifact<br/>that satisfies the goal}
    EB -- no --> DROP[discard — no evidence, no flag]
    EB -- yes --> CON{cross-model consensus<br/>>=93/100, min G1..G10 >=7}
    CON -- below --> ADV[advisory comment only<br/>route to Manager triage]
    CON -- ">=93" --> SEV{target is P1 or Epic?}
    SEV -- no --> AUTO[auto-file re-triage task<br/>reversible, $0]
    SEV -- yes --> HUMAN[IRREVERSIBLE cancel →<br/>human gate per auto-mode<br/>irreversible-action rule]
    style HUMAN fill:#ffe0b3
    style DROP fill:#d6ffd6
```

Four layered safeties:
1. **Evidence-binding** — a flag MUST cite the specific shipped artifact(s) that satisfy the dormant
   ticket's goal (the #1899 evidence = the red-team skills + #2192 gate). No evidence → no flag.
2. **Consensus threshold + minority-veto** — `>=93/100` cross-model + `min(G1..G10) >= 7`, with
   **median-of-N self-consistency draws** to damp single-draw rater noise (the LLM-as-judge stability
   protocol — §9). Crucially, supersession uses **minority-veto, not majority-vote**: a single capable
   model voting REJECT (goal NOT superseded) **vetoes** the flag. The LLM-judge calibration literature
   shows minority-veto lowers maximum error under class imbalance — and false-supersede is exactly the
   rare, high-cost class, so the asymmetry is principled, not ad-hoc. Below threshold → advisory only.
3. **Reversibility tier** — reversible actions (file a re-triage task, post an advisory) are
   autonomous; **irreversible** actions (cancel of a P1/Epic item) require a **human gate**, the same
   rule the auto-mode classifier enforces for irreversible local deletion ([[epic_3352_worktree_teardown]]).
4. **Precision calibration** — promotion advisory→blocking is **replay-eval-gated** against a labeled
   backlog-drift corpus at precision ≥0.85 (no calendar threshold, per `soak_language_default`). This
   mirrors the "frozen regression suite + evidence-coverage PROMOTE/ROLLBACK gate" pattern from current
   LLM-quality-gate work (§9), and optionally adopts **conformal-prediction** judge-uncertainty
   intervals so a low-confidence verdict is auto-demoted to advisory rather than acted on.

### 5.1 Replay-eval corpus + worked median-of-N verdict

C5's precision gate needs a concrete artifact: `tests/fixtures/backlog-drift-corpus.jsonl`, each row

```json
{"ticket_id": 1899, "goal_text": "cross-team adversarial red-team review skill",
 "shipped_artifacts": ["role-red-team-critique", "cross-family-review#2511", "fleet-review-required.js#2192", "megalint/*"],
 "ground_truth_superseded": true}
```

Seeded from prior manual audits (#1899 true-positive; plus true-negatives — dormant-but-still-needed
tickets — so precision is measurable, not just recall). Target **precision ≥0.85** on a held-out 10%
split (a wrong cancel is the costly error, so precision is gated, not recall). Worked **median-of-N**
verdict on the #1899 row: raw overall scores `[fleet-qwen 0.94, llama-70b 0.90, mistral 0.93]` →
median `0.93 ≥ 0.90 supersede-threshold` **and** evidence-bound (artifacts cited) → flag `superseded`;
had the median fallen below threshold or evidence been absent, the row emits **advisory-only**, never a
cancel. The corpus + this calibration live in Phase-1 child **C5**.

### 5.2 Evidence-binding rules (partial / transitive / conflicting artifacts)

A flag MUST cite shipped artifacts, but "is the goal satisfied?" is rarely all-or-nothing. The evidence
payload is structured `{artifact_id, contribution_score (0-1), rationale}` and resolution follows:

```mermaid
flowchart TD
    G[Goal of dormant ticket] --> C[sum of artifact contribution_scores]
    C -->|">= 1.0 (fully covered)"| F[flag superseded — full evidence]
    C -->|"0.5–1.0 (partial)"| P[flag PARTIAL — propose re-scope to the uncovered slice, NOT cancel]
    C -->|"< 0.5"| N[no flag — goal still substantially open]
    F --> T{conflicting artifacts?}
    T -->|yes| TB[tie-break: prefer higher contribution_score, then newer shipped_at]
```

Worked #1899: `role-red-team-critique` (0.4, the skill) + `fleet-review-required.js`/#2192 (0.35, the CI
gate) + `cross-family-review`/#2511 (0.15) + `megalint/*` (0.10) → Σ = 1.0 → **fully superseded**, every
contribution cited. A ticket summing to 0.7 would be flagged **PARTIAL** → re-scope to the 0.3 remainder,
never a blind cancel — the safety-asymmetric default (§5 axiom) holds at the evidence layer too.

**Transitive evidence validation (counsel R2).** A cited artifact may *itself* depend on something now
deprecated — e.g. a skill built atop a CI gate that was later removed. Before a Σ≥1.0 supersede is
honored, each cited artifact's own liveness is recursively validated (is the skill still deployed? is
the gate still wired into CI?). Any dead link in the evidence chain **downgrades the contribution to 0**
and re-sums — a once-satisfying chain that has rotted no longer cancels a ticket. This closes the
"evidence looks complete but is stale" false-supersede path.

---

## 6. AC-R6 — Consensus + closeout

Cross-model consensus result and Consultant closeout are recorded in the #3399 comment trail
(fleet-first $0 panel; target ≥93/100, min(G1..G10) ≥7). See the `CROSS_MODEL_CONSENSUS` and
`CONSULTANT_CLOSEOUT` comments on #3399.

---

## 7. Phase-1 child decomposition (recommendation — Manager authors after this closes ≥93)

**Sequencing (counsel R3): C2 is a hard precondition of C1.** The original decomposition treated C1 and
C2 as independent. But flagging a ticket `superseded` without first checking who points *at* it would
let the sweep **create the very orphans the Epic exists to prevent**. So C2 ships first, and C1's
supersede path calls C2's inbound check: a ticket with **live inbound pointers can only be flagged
PARTIAL** (re-home the pointers first), never `superseded`. The dependency is now explicit.

| Child | Deliverable | Class | Lane | Cost |
|---|---|---|---|---|
| **C1** *(inbound-orphan)* | `inbound-reference-integrity` — `issues.closed` sibling Action + auto-correction-task; folds in $0 `D10` PB4 dependency-rot (counsel R7) | PB2, PB4 | code-change | $0 deterministic |
| **C2** *(relevance, dep: C1)* | `backlog-relevance-sweep` — opt-in `--semantic` lane on `governance-drift-sweep.js`; PB1/PB3s flags w/ evidence; **must call C1's inbound check before any `superseded` flag** | PB1, PB3s | code-change | fleet-first $0 |
| **C3** | auto-route flagged items into baton (Manager-triage seed + Tier-2 anneal), not report-only; tag re-triage tasks `type:correction` (counsel R8) | all | code-change | $0 |
| **C4** | Wiki-B mirror refresh on **non-PR** state changes (the stale `wiki/work-log/tickets/1899.md` casualty) | — | code-change | $0 |
| **C5** | promotion advisory→blocking, replay-eval-gated; **tracks false-supersede *rate* (not just precision), requires ≤5% safety margin + human review for any P1/Epic flag until the margin is met** (counsel R4) | — | code-change | $0 |

**Advisory→blocking promotion** for the whole Epic is replay-eval-gated at precision ≥0.85 **and**
false-supersede-rate ≤0.05, never calendar-gated.

---

## 8. Goal-lens justification

- **G1 Governance + G2 Quality (lead):** undetected backlog drift lets stale/contradictory tickets
  misdirect work; the #2093 dangling pointer is a concrete G1 hit.
- **G3 Zero-Cost (hard constraint):** the relevance pass MUST be fleet-first $0 — the entire point is
  to stop burning premium tokens on human-prompted audits. Failover is free-cloud $0, never paid.
- **G6 Resilience:** autonomous detection removes the single point of failure (a human remembering to
  audit).
- **G8 Observability:** flagged drift becomes a tracked baton item + `incidents.jsonl` event, not an
  invisible accrual.
- **G4 Privacy:** cross-model dispatch sends only redacted ticket titles/bodies (already in GitHub);
  `log-redaction.js#redactString` is a hard precondition of the `--semantic` lane (§2) — no secrets/
  diffs/tokens leave the host.
- **G5 Portability / G6 Resilience:** no single vendor or the fleet host is a hard dependency — the
  lane degrades fleet → free-cloud → deterministic-only floor (§2), proven against this session's live
  groq Cloudflare-1010 block.
- **G7 Throughput:** model calls are bounded by a per-run candidate cap + content-hash memoization over
  the dormant subset (§2), not by total backlog size.
- **G8 Observability:** every flag, advisory, and auto-correction-task emission writes a schema-v3
  `~/.megingjord/incidents.jsonl` event (`pattern_id: backlog-semantic-supersession` / `inbound-reference-orphan`)
  and the sweep extends `governance-drift-sweep.js`'s existing `logs/governance-drift-sweep.json` report —
  drift becomes a tracked, queryable signal, never a silent accrual.
- **G9 Interoperability:** the guardrail's outputs are plain GitHub artifacts (a triage-seed Issue + a
  JSONL event), so all four runtimes (Claude Code / Copilot / Codex / Antigravity) consume them through
  the same baton with no per-team adapter — the enforcement core stays runtime-agnostic like
  `epic-close-readiness-check.js`.
- **G10 Maintainability:** extending the **single** #2981 sweeper (one drift surface, one ticket-list +
  classify + report scaffold) instead of forking a parallel skill is the deliberate maintainability
  choice — it prevents two drift surfaces from themselves drifting apart.

---

## 9. Prior art & external SOTA alignment (web-research-grounded)

This design is not invented in a vacuum — each core mechanism aligns with current (2025–2026)
literature, and two mechanisms were *sharpened* by it (the embedding pre-filter §2; minority-veto +
self-consistency §5). Web-research-grounded mapping:

| Design element | External SOTA it draws on |
|---|---|
| PB1 semantic-supersession (LLM judges "same goal?") | LLM-for-SE survey (AwesomeLLM4SE, SCIS 2025); LLM-guided issue relevance + confidence scoring (arXiv 2501.11709, MSR'25) |
| Embedding pre-filter for candidate ranking (§2) | Duplicate-bug-report dedup: siamese/triplet embedding nets, LLM-embedding recall@k 68–74%; `GitBugs` benchmark (arXiv 2504.09651); `Cupid` ChatGPT-assisted dedup; "Does DL improve dup detection?" (ScienceDirect S016412122300002X) |
| Median-of-N + minority-veto + consensus threshold (§5) | LLM-as-judge calibration: conformal-prediction uncertainty intervals (arXiv 2509.18658); linear-probe judge calibration (2512.22245); ensemble-across-families + minority-veto under class imbalance; self-consistency stability |
| Inbound-orphan as existence-dependency edge (§3) | KG existence-dependencies (KGCW'25); dangling-dependency BFS resolution + orphan allocation (arXiv 2310.14093); reference-rot ≈23% / content-drift ≈50% |
| Replay-eval precision gate, advisory→blocking (§5, C5) | Replay-based continual eval (IEEE 10675906); evidence-driven quality gate with PROMOTE/ROLLBACK on coverage threshold + frozen regression suite (arXiv 2603.15676) |
| Tracking GenAI-era bug/issue workflows | "Past, Present, and Future of Bug Tracking in the Generative AI Era" (arXiv 2510.08005) |

**Net effect:** the guardrail is a domain-specific composition of proven methods — embedding dedup +
calibrated LLM-judging + KG existence-dependency checks + replay-eval promotion — applied to the
**pre-baton dormant-backlog** surface that none of the existing harness tools (#2981/#3235/#3350) cover.

## 10. Evolution log — cross-model counsel → plan changes

This deliverable was evolved across rounds of cross-family expert counsel; the rating rose as a
*consequence* of plan changes, not as a target. Each row is a recommendation that materially changed
the design or the Phase-1 plan.

| Round | Expert counsel | Plan change it drove |
|---|---|---|
| R1 | Mistral flagged G4/G7/G5 gaps | §2 explicit `log-redaction` precondition (G4); candidate-cap + content-hash memoization bound (G7); tier-graceful fleet→free-cloud→deterministic-floor fallback (G5/G6) |
| R2 | "goal-lens incomplete" | §8 explicit G8/G9/G10 coverage |
| R3 | "what makes it a 95" | §2.1 D5/D6 candidate-filter recall audit + `--force-scan`; §5.1 replay-eval corpus + worked median-of-N verdict; §5.2 evidence-binding decision tree |
| R4 | web-research SOTA | embedding pre-filter for PB1 (dedup literature); minority-veto + self-consistency + conformal calibration (LLM-judge literature); §9 prior-art map (12 cites) |
| R5 | "evolve the *plan*, not the score" | §5.2 **transitive evidence validation** (rotted-chain → contribution 0); §2.1 **velocity-relative dormancy** signal (adapted from experts' calendar form, which this harness rejects); §7 **C1↔C2 re-sequence** (inbound check precedes any supersede → the sweep can't create orphans); §7 **C5 false-supersede-rate ≤5% margin** + P1/Epic human gate |
| meta | client flagged operator "rating-shopping" | filed self-anneal **#3416** (fixed-panel + counsel-driven + honest-escalation guardrail); loop refocused from chasing a number to evolving the plan |

**Honest consensus record:** unanimous cross-family ACCEPT, zero blocking gaps, per-goal min 8–9.4/10;
overall spread 87 (gpt-4o, harsh) → 92 (llama-3.3-70b ×2) → 95 (mistral-large, frontier); median ~92.
The SOTA reasoning-judge class (o1/o3/DeepSeek-R1) was unavailable (GitHub-Models 4k-token input cap).
Per #3416, the panel was **not** expanded to move the median; the value taken was the counsel above.

## 11. References

- Origin: #1899 (cancelled 2026-06-30) · casualties #2093, #3069 (orphaned pointers, corrected)
- Extends: #2981 `governance-drift-sweep.js` (deterministic structural sweep — adds the excluded semantic layer)
- Boundary: #3235 (active-baton Consultant-CI) · #3350 `epic-close-readiness-check.js` (outbound close-readiness)
- Client autonomy directive: #3391 / #3392 (minimize human interaction)
- Patterns: `consensus_rater_noise_aggregation`, `soak_language_default`, `free_consensus_panel_substrates`
