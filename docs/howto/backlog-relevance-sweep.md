# Backlog Relevance Sweep (`--semantic` lane)

_Epic #3398 C2 (#3420). Extends the deterministic `governance-drift-sweep` (#2981) with an
opt-in cross-model supersession lane. Sits **above** #2981's structural sweep and **before**
#3235's active-baton Consultant gate — the pre-baton semantic-drift layer._

## What it does

`node scripts/global/governance-drift-sweep.js --semantic [--force-scan]` flags dormant
backlog tickets whose goal is likely **already satisfied by shipped work**, with cited
shipped-artifact evidence. The default `--scan` path is unchanged and stays **$0 /
deterministic** — the semantic lane is the only path that ever calls a model.

## Pipeline

1. **Candidate selection** — the D5/D6 dormant-backlog subset (reused from the sweep
   classifier), narrowed to the bottom **velocity-relative recency quantile** (most-dormant
   first; **no calendar threshold**). `--force-scan` scans the whole pool.
2. **Embedding pre-filter** — candidates are ranked by cosine similarity to a goal-query
   vector before any verdict, so the cross-model spend targets the strongest candidates.
   Graceful: no query vector / no local embedder → identity order, no model call.
3. **Fleet-first verdict cascade** — `fleet` (local Ollama loopback, zero egress) →
   `free-cloud` failover (the shipped $0 providers, #2621) → **deterministic floor**. The
   lane **never escalates to a paid tier**; an all-$0-tiers-down cascade fails closed to a
   non-superseded floor (a wrong cancel is the costly error).
4. **Aggregation** — median-of-N score + **minority-veto** (any non-superseded dissent caps
   the verdict at `partial`).
5. **Evidence binding** — a `superseded` verdict must carry `{artifact_id, contribution_score,
   rationale}` with an **acyclic transitive chain**, else it is downgraded to `partial`.
6. **Inbound sequencing gate (AC4)** — before emitting any `superseded` flag the lane runs the
   C1 inbound check (`inbound-reference-integrity#scanInbound`, #3419). A ticket with **live
   inbound pointers** can only be `partial`, never `superseded` — the sweep must never create
   the orphans C1 exists to catch.

## Privacy (G4)

Every ticket blob is `log-redaction`-redacted before it leaves the machine for a model.

## Output

JSON `{ mode, route, scanned, flags: [{ ticket, flag, reason, route, medianScore, n, veto,
evidence, inbound }] }`. Detection is report/route-only here; auto-routing into the baton is
C3 (#3421), and the advisory→blocking promotion is C5 (#3423).
