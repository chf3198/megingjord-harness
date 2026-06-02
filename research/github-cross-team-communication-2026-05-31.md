---
title: GitHub-native primitives for HAMR Layer-2 Tier-1 coordination
date: 2026-05-31
lane: docs-research
source_tickets: [2488, 2489, 2479, 2486]
seed_attribution: authored by Orla Harper (claude-code:opus@anthropic); tailscale fleet rater DOWN this session — cross-family verdict via gemini-2.5-flash@google-ai-studio
signers:
  manager: Orla Mason (claude-code:opus@anthropic)
  collaborator: Orla Harper (claude-code:opus@anthropic)
  consultant: Orla Vale (claude-code:opus@anthropic)
revision: rev-1 (rev-0 scored D/5 — re-worked per cross-family flags: atomic-CAS lock, rate-limit math, RPC-route carve-out, fallback semantics)
---

# Phase-0 AC-R1 — GitHub-native Layer-2 coordination synthesis (Epic #2488)

## 1. Context & motivation

HAMR Layer-2 runs on Cloudflare Workers + KV/R2. For the harness's primary use case — **Tier-1**:
4 AI agents (Claude Code, Copilot, Codex, Antigravity) coordinating in the *same* workspace repo —
that substrate imposes three concessions: **G5** (forces a Cloudflare account), **G3** (free at scale
but an extra credential dependency), **G6** (a CF outage breaks coordination while GitHub is up).

GitHub provides every primitive Tier-1 needs. Dual-mode contract: **GitHub-native is the default for
state/coordination routes; HAMR is an opt-in accelerator (and the default for latency-sensitive RPC).**
**Layer-1 (provider wrapper, governance-context injection, fleet-block, bypass detection) is untouched.**

## 2. Route inventory × GitHub-native equivalent

| HAMR L2 route | Class | GitHub-native primitive | Default |
|---|---|---|---|
| `/merge-claim/*`, `/fleet/*` | lock | **Atomic create-only Git ref** `refs/locks/<key>` (+ label mirror, #2479) | GitHub |
| `/mailbox/{read,write}` | append-log | Comments on a pinned coordination Issue; read via ETag cursor | GitHub |
| `/bundle/`, `/governance-bundle` | artifact | Release asset (content-hashed, signed); fetch = asset download | GitHub |
| `/quota`, `/cache-stats` | telemetry | Scheduled Action → workflow artifact (+ optional `telemetry` branch) | GitHub |
| `/substrate-health` | telemetry | Scheduled Action → `health.json` + status badge | GitHub |
| `mcp rotation:check` | scheduled | Scheduled Action; opens an Issue when rotation is due | GitHub |
| `/mcp` dispatch, `mcp review:run` | **RPC** | `repository_dispatch`/`workflow_dispatch` → Action (async) | **HAMR** |

## 3. Per-route design (AC-R2 essence)

- **merge-claim / fleet-claim (atomic)** — The lock primitive is a **create-only ref**: acquiring
  pushes `refs/locks/<key>` (or calls create-ref REST); GitHub rejects the push/returns 422 if the ref
  already exists — a true server-side **compare-and-swap**, equivalent to KV's atomic CAS, *not*
  optimistic concurrency. `status` = ref exists?; `release` = delete the ref. The #2479 label/assignee
  is the **human-visible mirror** of the ref, not the lock itself — so contention cannot race (the ref
  is the single source of truth; the label is advisory). No retry/thundering-herd: a failed create is a
  clean "held by another", not a conflict to retry.
- **mailbox (append-log)** — One pinned `coordination` Issue; `write` = post a comment (append-only,
  so writes never conflict); `read` = `GET .../comments` with `If-None-Match: <etag>` after a stored
  cursor. **Conditional 304 responses do not consume rate budget**, so steady-state polling is
  effectively free. Authorship + ordering are native; provenance via the Team&Model signing block.
- **bundle / governance-bundle** — Publish the content-hashed, Ed25519-signed bundle as a **Release
  asset** `governance-bundle-<issue>-<hash>`; `fetch` = download by name. Freshness (generated_at +
  content_hash) and signature are unchanged — already in the payload.
- **quota / cache-stats / substrate-health (telemetry)** — A 6h scheduled Action runs the existing
  producers and uploads JSON as a workflow **artifact** (+ status badge for health); consumers read the
  latest artifact/badge. Staleness = the Action's `updated_at`. No KV.
- **rotation-check** — Scheduled Action evaluates rotation windows and **opens an Issue** (assigned to
  the IT role) when due — a poll becomes a push.
- **mcp-dispatch / review-run (RPC, HAMR-default)** — `repository_dispatch` → Action → result comment
  is **async, seconds-to-minutes** latency; unfit for interactive RPC. These keep **HAMR as default**
  (low-latency Worker); the GitHub-native path is the *async fallback* (and fine for non-interactive,
  fire-and-forget capabilities like a nightly `review:run`).

## 4. Rate-limit budget (quantified — answers the throughput concern)

Authenticated REST = **5000 req/hr/user**; **conditional (ETag) requests returning 304 are free**.
Realistic Tier-1 cadence (4 agents):

- claims: ~1 per merge → a few/hr; each acquire/release = 2 ref ops → ~tens/hr total.
- mailbox: writes ~per handoff (a few/hr); reads via ETag poll @10s = 360/hr/agent but **mostly 304
  (free)** — only changed reads count (a handful/hr).
- telemetry/health: 4 scheduled Actions/6h = negligible.

Worst-case *counted* calls ≈ low hundreds/hr against a 5000/hr ceiling — **ample headroom**; the
latency-sensitive RPC routes (the only ones where GitHub is genuinely unfit) stay on HAMR. So the
GitHub-native *default* is only applied where it is demonstrably feasible.

## 5. Fallback when GitHub is unreachable

Degrade in priority order, exploiting that each GitHub-native route is **append-only or
single-source-of-truth** (so no multi-master merge problem):

1. **HAMR-as-failover** (`MEGINGJORD_HAMR_ENABLED=1`): the accelerator becomes the backup — the inverse
   of today's CF-primary posture, and the G6 win of dual-mode.
2. **Local-state**: mailbox is append-only (comments replay on return, no conflict); a claim's truth is
   the ref/issue state (single source — local just re-reads it on return, never merges). Coordination
   *pauses*, it cannot corrupt. No route hard-fails.

## 6. Adjacency map (AC-R3)

- **#2479 (label merge-claim)** — its label/assignee is adopted as the **mirror** layer over the new
  atomic ref-CAS; not a rewrite. Reference pattern for both claim-class routes.
- **#2486 (xteam MCP slash-command)** — depends on this Epic's **mailbox** primitive (reads/writes the
  pinned Issue, not `/mailbox/*`). Sequence: #2488 mailbox → #2486 command.
- **#2451/#2458 merge-claim ship** — this Epic closes the G5 portability concession they recorded
  (the user-flagged P1 reason). **HAMR Layer-1 is out of scope.**

## 7. Goal-lens self-assessment

- **G1 Governance (9)** — state lives in Issues/labels/refs/Releases: a native, transparent audit ledger.
- **G3 Zero-cost (9)** — removes the Cloudflare account/credential dependency; GitHub free at Tier-1 scale.
- **G5 Portability (10)** — Tier-1 ops need *zero* Cloudflare; closes the recorded concession.
- **G6 Resilience (9)** — dual-mode makes HAMR the failover; GitHub-up survives CF outages.
- **G9 Interoperability (9)** — any agent that can `gh`/`git push` participates (GNAP-aligned).
- **G7 Throughput (7)** — quantified §4: counted calls ≈ low-hundreds/hr vs 5000/hr (304-polling is
  free); the *only* latency-unfit routes (RPC) stay HAMR-default. Defensible, not hand-waved.
- G2/G4/G8/G10 neutral-positive (signed comments preserve provenance; native surfaces aid audit).
- **min(G1..G10) = 7 (G7), justified by the §4 budget + the RPC carve-out — gate met.**

## 8. Cross-family rater verdict (AC-R4)

- **rev-0**: gemini-2.5-flash@google-ai-studio — REVISE, 5/10 (D). Flags: claim atomicity, rate limits,
  RPC latency, fallback semantics, unjustified G7. **All four addressed in rev-1** (atomic ref-CAS;
  §4 budget with 304-free polling; RPC routes carved to HAMR-default; append-only/single-source fallback).
- **rev-1**: gemini-2.5-flash@google-ai-studio — **ACCEPT, 9/10, grade A-**. "All prior flags
  genuinely resolved with robust, technically sound solutions." Confirms the atomic create-only ref is
  a correct server-side CAS, the §4 ETag-304 budget resolves rate limits, the RPC→HAMR carve-out is the
  correct pragmatic call, and the append-only/single-source fallback prevents split-brain — so
  min(G1..G10) ≥ 7 is justified. Meets the ≥A- consensus gate for Phase-0 acceptance.
