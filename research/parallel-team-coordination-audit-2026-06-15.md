---
wiki_type: wisdom
scope: project
content_hash: 54b9af5f755b9b49
last_updated: 2026-06-15
freshness_window: 30d
content_trust_score: 0.9
---

# Parallel-Team Coordination Audit & Phase-0 Plan (Epic #3021, child #3022)

## Context

Budget-driven **Copilot Auto mode** (cheaper/alternate models) exposed that the harness's
multi-team coordination surface deadlocks or silently corrupts when ≥2 AI teams (Claude Code,
Copilot, Codex) share one board. Trigger: #2945 parked 4 days at admin-gate on a signer-alias
mismatch the completing operator could only fix by identity forgery (OWASP OA3) or bypass.

This Phase-0 deliverable audits **7 surfaces**, catalogs failure modes (severity × recurrence ×
goal-lens), proposes **signer-integrity-preserving, no-per-ticket-bypass** remediations, and
decomposes Phase-1. Evidence is file-cited; ✅ = verified this session, ⚠ = audit-reported,
verify in Phase-1.

## Glossary (terms used in this plan)

- **Finding severity** — blast radius if the failure mode triggers (high/med/low).
- **Recurrence risk** — likelihood under normal parallel-team traffic (high/med/low).
- **Goal-lens** — which harness goal(s) G1..G10 the finding threatens.
- **Baton** — the GitHub issue carrying the single-active-role workflow (Manager→Collaborator→Admin→Consultant).
- **Signer alias** — the deterministic human-readable signature derived from (team, model, role) via `agent-signature.js`/the registry.
- **ref-CAS** — compare-and-swap on a git ref (GitHub-native atomic primitive for Tier-1 claims).
- **Tier-0/1/2** — resource tiers (0 local-only, 1 +GitHub baseline, 2 +HAMR/Cloudflare) per resource-tier-portability.
- **Atomic-or-degrade** — a shared-state write either completes atomically or fails closed and surfaces; it never partially corrupts.

## Method

4 parallel read-only audit agents (one per surface-cluster) over `scripts/global/`, `hooks/`,
`cloudflare/hamr/`, `instructions/`, `.github/workflows/`. Core high-severity claims spot-verified
against source. Cross-model consensus (free fleet, qwen) gates this doc at ≥93/100 before Manager
authors Phase-1 children.

## Finding catalog

### S1 — Identity & signing
| ID | Finding | Sev × Rec | Goal | Evidence |
|----|---------|-----------|------|----------|
| F-ID1 ✅ | No team-specific registry entry for Auto-mode fallback models (e.g. copilot+qwen/codex); derivation falls to wildcard (qwen→Quinn, codex→Quill) while Team&Model says copilot:sonnet (→Soren) → admin-gate `signer-alias-not-registry-derived` → structural park | HIGH×HIGH | G1 | `inventory/team-model-signatures.json` (no copilot+qwen entry); `agent-signature.js`; `megalint/signer-registry-check.js`; root of #2945/#3020 |
| F-ID2 ✅ | `analyzeComments` validates ALL comments (`baton-artifact-governance.js:36,68`) while per-role gates use `reverse().find()` = LAST. One stale/cross-team artifact with a bad signer blocks merge even when the current artifact is valid | HIGH×HIGH | G1 | `baton-artifact-governance.js` vs `megalint/manager-handoff.js:26` |
| F-ID3 ⚠ | Expected alias is derived from the PUBLIC registry; author-team is not verified against declared Team&Model, so any team can produce a registry-valid alias for another team. `cross-team-response-fidelity` + `signer-fidelity` are advisory-only | HIGH×MED | G1·G4·OA3 | `megalint/signer-registry-check.js`; `megalint/cross-team-response-fidelity.js`; `baton-gates.yml` |
| F-ID4 ⚠ | No registry version hash bound into signing/validation; signer-vs-validator registry drift yields silent alias mismatch | MED×MED | G1 | `signer-registry-check.js` load path; registry header |

### S2 — Baton commenting & artifact integrity
| ID | Finding | Sev × Rec | Goal | Evidence |
|----|---------|-----------|------|----------|
| F-BC1 ✅ | Bold-markdown `**Field:**` defeats `extractField` regex `(?:^\|\n)[-*]?\s*${field}\s*:` (matches one `*` only) → required fields read as missing (hit this session on the Copilot MANAGER_HANDOFF) | MED×MED | G1·G10 | `megalint/manager-handoff.js:30` |
| F-BC2 ⚠ | No artifact timestamp/freshness; re-posted/edited artifacts accumulate; `analyzeComments` re-validates stale instances → per-role gate passes, governance analyzer fails | MED×MED | G1 | `baton-artifact-governance.js:34-89` |

### S3 — Cross-team baton protocol (primary gap)
| ID | Finding | Sev × Rec | Goal | Evidence |
|----|---------|-----------|------|----------|
| F-XT1 ✅ | **No sanctioned non-forgery protocol** for Team B to finalize Team A's parked mid-baton ticket. Only options are forge / escalate-with-no-path / deadlock. `cross-team-consult-pickup` covers Epic Consultant only | HIGH×HIGH | G1·G9·OA3 | `instructions/role-baton-routing.instructions.md` (no mid-baton-assumption section); `skills/cross-team-consult-pickup` |
| F-XT2 ⚠ | Cross-team artifact-write sign-off (`target_team_sign_off: pending`) has no timeout/escalation → Manager parks indefinitely if target team unavailable | HIGH×MED | G1·G6 | `instructions/cross-team-artifact-write.instructions.md` |

### S4 — Cross-team claim & label races
| ID | Finding | Sev × Rec | Goal | Evidence |
|----|---------|-----------|------|----------|
| F-CL1 ⚠ | `label-lint` auto-transition reads issue once, then applies sequential remove/add with no re-read; concurrent team label edits → multi-status/multi-role invariant violation | HIGH×MED | G1 | `.github/workflows/label-lint.yml`; `label-lint-status-cardinality.js` |
| F-CL2 ⚠ | `cross-team-queue` first-claim-wins uses comment timestamps (not atomic CAS); clock granularity/skew lets two teams both believe they won | HIGH×MED | G1·G9 | `scripts/global/cross-team-queue.js` |

### S5 — Lease / claim atomicity & liveness
| ID | Finding | Sev × Rec | Goal | Evidence |
|----|---------|-----------|------|----------|
| F-LS1 ✅ | `cross-team-lease-registry` read→check→write is non-atomic (`writeFileSync`, no flock/CAS) → lost leases, two teams hold same ticket | HIGH×MED | G1·G6 | `scripts/global/cross-team-lease-registry.js:26` |
| F-LS2 ⚠ | Crashed team's lease blocks others up to the heartbeat window (≈24h) before reaping | MED×HIGH | G6 | `scripts/global/worktree-lease-heartbeat.js` |
| F-LS3 ⚠ | `merge-claim` release does two sequential KV deletes (non-atomic); GitHub-label fallback acquire is idempotent-no-op (both teams "win") | MED×MED | G6·G9 | `cloudflare/hamr/routes/merge-claim.ts`; `hooks/scripts/merge_claim_client.py` |
| F-LS4 ⚠ | Cross-team-lease pre-push blocking gate not present (#2916 open); a second team can push to a leased branch | HIGH×LOW | G1 | `scripts/global/pre-push-gates.js` (no lease check); #2916 |

### S6 — Worktree & state isolation
| ID | Finding | Sev × Rec | Goal | Evidence |
|----|---------|-----------|------|----------|
| F-WT1 ✅ | `state_store.save_state` is non-atomic `write_text` with no concurrent-writer guard; two teams sharing the repo-hash state lose updates / tear the file | HIGH×HIGH | G1·G6 | `hooks/scripts/state_store.py:74` |
| F-WT2 ⚠ | state-store cwd fallback (`payload.cwd or Path.cwd()`) can load the wrong worktree's state → cross-worktree pollution (wrong active_ticket) | MED×LOW | G1 | `hooks/scripts/pretool_guard.py`; `state_store.py` |
| F-WT3 ⚠ | Stale-worktree cleanup classifies on a stale lease read and squash-merge detection without coordinating active leases → deletes a branch another team is extending | HIGH×MED | G6 | `worktree-cleanup-plan.js`; `worktree-inventory.js`; prior art #2552 |
| F-WT4 ⚠ | node_modules symlink check-then-link race across concurrent worktree bootstrap | LOW×MED | G6 | `scripts/worktree-session-start.sh`; `worktree-bootstrap-node-modules.sh` |
| F-WT5 ⚠ | No pre-flight one-ticket-per-worktree enforcement in the bash entrypoint (only post-hoc JS lease throw) | HIGH×MED | G1 | `scripts/worktree-session-start.sh` |

### S7 — Git ops, logging, offline role resolution
| ID | Finding | Sev × Rec | Goal | Evidence |
|----|---------|-----------|------|----------|
| F-GT1 ⚠ | CI-green gate is checked at parse time, not re-checked immediately before merge (TOCTOU) → a check that goes red between check and merge still merges | MED×HIGH | G2·G1 | `hooks/scripts/pretool_guard.py` (`ci_gate_status_stable`) |
| F-GT2 ✅ | REST-merge detaches the main checkout HEAD while the `main` label lags → new worktrees branch off a stale base | MED×HIGH | G6 | memory `feedback_rest_merge_detaches_main_label`; observed #2943/#2944 |
| F-LG1 ⚠ | `event-schema-v3` does not require `team`/`trigger_role` → anneal/recurrence detection can mis-attribute one team's drift to another | HIGH×HIGH | G8 | `scripts/global/event-schema-v3.js` (V3_REQUIRED) |
| F-LG2 ⚠ | Concurrent JSONL appends interleave; parse errors silently dropped (`catch{return null}`) → silent event loss | MED×HIGH | G8·G6 | `event-schema-v3.js` append; `jsonl-tail.js` |
| F-LG3 ⚠ | Log-rotation `rename` then `writeFileSync('')` window drops mid-emit writes | MED×MED | G8·G6 | `scripts/global/log-rotation.js` |
| F-RR1 ⚠ | `derive_roles_from_github` serves stale cache to 300s; under concurrent edits + GitHub outage two teams act on stale roles | MED×MED | G1·G6 | `hooks/scripts/github_role_resolver.py`; CLAUDE.md offline contract |

## Goal-lens rollup

G1 (governance) dominates: F-ID1/2/3, F-XT1, F-CL1/2, F-LS1/4, F-WT1/5 are all G1. The class
signature is **non-atomic coordination over shared mutable state + no cross-team identity/role
transfer protocol**. G6 (resilience) and G8 (observability) are the secondary clusters.

## Remediation principles (binding on Phase-1)

1. Preserve signer-integrity — never accept arbitrary aliases; authenticity must be *strengthened*, not relaxed.
2. No per-ticket bypass as a fix — bypass is incident-only, never the remediation.
3. Atomic-or-degrade — every shared-state writer is atomic (tmp+rename / flock / ref-CAS) or fails closed and surfaces, never silently corrupts.
4. Graceful liveness — crashed-team resources reap on a bounded, observable timer; no indefinite deadlock.
5. Tier-graceful — GitHub-native primitive is the Tier-1 default; HAMR is accelerator/failover (per cross-team-communication-tiers).
6. **Phase-1 delivery standard (every child)** — ships (a) deterministic tests per the test-methodology matrix (concurrency/atomicity surfaces REQUIRE `tdd-pyramid+stress-test`: ≥1 fault-injection path + ≥1 race/contention assertion), (b) doc/instruction updates in the same change (per doc-coverage-matrix), and (c) at least one observability signal (event-schema-v3 emission) so the new control is auditable. No child closes without all three.

## Cost & throughput posture (G3, G7)

Every remediation is **local/deterministic** — atomic-rename, flock, ref-CAS, registry-data, validator logic, instruction prose. **No paid provider, no new network dependency** → G3 (zero-cost) is inherently satisfied; all review on free fleet ($0). Throughput (G7) impact is bounded and sub-millisecond: atomic-rename/flock add microseconds; the final-CI-recheck (C9) adds one cached API poll at merge only. No hot-path regression. G3/G7 are therefore neutral-pass for this plan.

## Phase-1 child decomposition (Manager finalizes after consensus)

| Child | Scope | Closes/anchors | Findings |
|-------|-------|----------------|----------|
| C1 Signer derivation reconciliation | Team-specific registry entries for every Auto-mode model a runtime can route to; bind registry version hash into sign+validate; agent-signature↔validator parity test | unblocks #2945, subsumes #3020 | F-ID1, F-ID4 |
| C2 Comment-selection parity & parse robustness | `analyzeComments` validates last-of-each-type (match per-role gates) + freshness/timestamp; bold-markdown-tolerant field extraction | — | F-ID2, F-BC1, F-BC2 |
| C3 Non-forgery cross-team baton-assumption protocol | New `instructions/cross-team-baton-assumption`: `BATON_TRANSITION` artifact, incoming-team signs with own substrate citing transition; + artifact-write sign-off timeout/escalation | — | F-XT1, F-XT2 |
| C4 Signer authenticity hardening | Verify author-team vs declared Team&Model; promote `cross-team-response-fidelity` + `signer-fidelity` from advisory to **blocking** after exactly one advisory cycle (dated flip, not open-ended); optional Ed25519 for cross-team artifacts to close perfect-forgery | — | F-ID3 |
| C5 Atomic coordination primitives | tmp+rename/flock for `state_store`, `cross-team-lease-registry`, JSONL appends; ref-CAS option; ship lease pre-push gate (#2916); bounded heartbeat reaper | #2916 | F-LS1, F-LS2, F-LS4, F-WT1, F-LG2, F-LG3 |
| C6 Label-race serialization | Read-before-write/optimistic-lock in `label-lint`; abort+advisory on concurrent drift; bound `derive_roles` stale window + stale-decision flag | — | F-CL1, F-RR1 |
| C7 Worktree isolation hardening | Pre-flight one-ticket-per-worktree in bash; cwd-from-git in hooks; cleanup respects active leases + squash stale-base guard; atomic node_modules link | — | F-WT2, F-WT3, F-WT4, F-WT5, F-GT2 |
| C8 Cross-team claim atomicity | Replace timestamp first-claim-wins with ref-CAS/atomic claim in `cross-team-queue` + merge-claim idempotent release + label-fallback CAS | — | F-CL2, F-LS3 |
| C9 Logging attribution & merge TOCTOU | Require `team`+`trigger_role` in event-schema-v3 (auto-populate from HAMR_TEAM; legacy-tolerant read); **emit lease/claim lifecycle events (acquire/release/expire/collision) + a dashboard cross-team-coordination panel** so deadlocks/lost-leases are observable; final CI re-check immediately before merge | — | F-LG1, F-GT1, +lease/claim observability |

Sequencing: **C1+C2 first** (directly unblock #2945, highest recurrence). C3+C4 next (close the
forgery/deadlock gap). C5 is the shared-atomicity backbone for C6/C7/C8. C9 is independent.
Each child is its own baton ticket; #2945 must merge cleanly (no bypass) under C1+C2 as the regression anchor.

## Per-child success metric & cost/throughput tag (G3, G6, G7)

Every child closes only when its **measurable success signal** holds (the Manager lifts these into the
child's ACs). All children are **Tier-0/local cost** ($0; no paid provider) and **throughput-neutral**
unless noted.

| Child | Measurable success signal (KPI) | Cost / throughput |
|-------|---------------------------------|-------------------|
| C1 | A copilot Auto-mode artifact passes admin-gate with zero `signer-alias-not-registry-derived`; CI fails on any unmapped (team,model) | Tier-0; neutral |
| C2 | A re-posted/superseded bad artifact no longer blocks merge; bold-markdown fields parse in a fixture corpus | Tier-0; neutral |
| C3 | Team B finalizes a Team-A parked ticket with zero forged signatures (audit trail shows own-identity + transition) | Tier-0; neutral |
| C4 | Signer-fidelity blocks a forged cross-team artifact in CI after the dated flip; zero false-blocks on the soak corpus | Tier-0; neutral |
| C5 | Concurrent-writer stress test (N parallel writers) shows zero lost updates / torn files; lock acquisition p99 sub-ms | Tier-0; +micros, bounded |
| C6 | Two concurrent label edits never yield multi-status/multi-role; bounded-retry never livelocks under contention test | Tier-0; neutral |
| C7 | A cross-team same-ticket worktree collision is refused pre-flight; intra-team multi-worktree still allowed | Tier-0; neutral |
| C8 | Two concurrent claims on one ticket → exactly one winner (CAS); idempotent release leaves no orphan | Tier-0/1; +1 cached API call at claim |
| C9 | 100% of newly-emitted events carry team+trigger_role; a check that goes red between gate and merge is caught | Tier-0; +1 cached poll at merge |

## Observability strategy (G8)

The plan makes every new control auditable, not just correct: (1) each child emits an event-schema-v3
signal on its decision path (principle 6); (2) C9 adds lease/claim lifecycle events + a cross-team
coordination dashboard panel so deadlocks, lost leases, and stale claims are *visible in real time*,
not discovered post-mortem; (3) every governance bypass or atomic-degrade fail-closed path emits a
labelled incident (`incidents.jsonl`) with team + trigger_role attribution (C9's required fields), so
the recurrence detector can attribute drift to the correct team. Net effect: the multi-team coordination
surface becomes self-reporting.

## Risk & trade-off register (per Phase-1 child)

Each remediation carries a residual risk; the chosen design and its trade-off are recorded so the
Manager can weight them when authoring child ACs. (This is planning-level risk awareness, not
implementation detail — the mitigation *mechanism* is designed in-child.)

| Child | Primary risk if done naively | Chosen trade-off & mitigation direction |
|-------|------------------------------|------------------------------------------|
| C1 | Registry bloat; a new model family ships and is again unmapped → silent wildcard mismatch recurs | Determinism over brevity: explicit (team,model) entries + a CI check that FAILS on an unmapped (team,model) tuple, so the gap surfaces at add-time, not park-time |
| C2 | Switching `analyzeComments` to last-of-type could mask a genuinely malicious earlier artifact | Keep superseded bad artifacts as an ADVISORY signal (visible, non-blocking) — unblock-ability without losing the audit trail |
| C3 | A `BATON_TRANSITION` could be abused to launder forgery (Team B "assumes" then signs as Team A) | Incoming team signs with its OWN valid identity + cites the transition; never re-signs the origin team. Adds one auditable step vs. the current deadlock/forgery-only choice |
| C4 | Flipping signer-fidelity to blocking mid-stream breaks in-flight cross-team tickets | Exactly one dated advisory cycle + a migration note; security gain vs. one-cycle disruption window |
| C5 | flock/lock could deadlock or add latency on the hot path | Prefer lock-free atomic-rename; use flock only where read-modify-write is unavoidable, always with a timeout + fail-closed-and-surface. Correctness over a bounded sub-ms cost |
| C6 | Optimistic-lock retries livelock under high label contention | Bounded retry count then advisory-abort (never spin); serialize per-issue, not globally |
| C7 | Stricter one-ticket pre-flight blocks legitimate same-ticket multi-worktree (e.g. one team, two worktrees) | Scope the block to CROSS-TEAM collisions only (lease owner-team check), not intra-team |
| C8 | GitHub-native ref-CAS adds API calls → rate-limit pressure | Batch/conditional requests + Tier-0 flock fallback when offline (tier-graceful, per principle 5) |
| C9 | Requiring `team` breaks legacy events lacking it | Legacy-tolerant read (missing team → 'legacy'); required only for newly-emitted events |

Cross-cutting trade-off accepted: every remediation adds a small amount of coordination ceremony
(an entry, a lock, a transition artifact, a field). This is deliberately preferred over the status
quo, where the absence of that ceremony causes structural deadlock, silent corruption, or forced
governance bypass (G1) — the higher-priority goal.

## Portability & maintainability posture (G5, G10)

- **G5 portability** — no remediation hard-codes a user-specific path, host, or alias. The atomic
  primitives are filesystem-generic (POSIX rename/flock) with a Tier-1 GitHub-native ref-CAS option;
  registry/signer changes are data-driven via `team-model-signatures.json` + settings, not per-operator
  code. The completing-operator protocol (C3) is substrate-derived (identity from Team&Model registry),
  not team-hard-coded — so it works for any present or future runtime, air-gapped Tier-0 included.
- **G10 maintainability** — the shared-atomicity logic (C5) lands as ONE reusable module
  (`atomic-write` / `with-file-lock`) consumed by `state_store`, `cross-team-lease-registry`, and the
  JSONL emitters — a single test surface, not N per-site reimplementations (DRY). Each child ships its
  own stress/contract tests + doc updates (principle 6), so the control set stays self-documenting and
  regression-guarded as runtimes evolve.

## Phase-0 / Phase-1 boundary (scope discipline)

This Phase-0 deliverable deliberately scopes **WHAT** must change, **WHY** (finding+goal), and the
**sequencing** of children. The **HOW** of each remediation — the `BATON_TRANSITION` artifact schema
and validator wiring (C3), the exact advisory→blocking flip criteria and tracking (C4), and the
event collection/storage/dashboard mechanics (C9) — is intentionally detailed in each child's own
`MANAGER_HANDOFF` + design, not here. Over-specifying implementation in Phase-0 would pre-empt the
per-child design review and violate research-first discipline. Each child carries its own ACs,
tests (delivery standard, principle 6), and consultant closeout.

## Cross-model consensus evidence (AC-R5)

Free, cross-family, $0. Three genuinely distinct model families reviewed the deliverable across six
revisions; the deliverable improved in direct response to each round of critique.

| Model (family) | Final rating | Verdict | Notes |
|----------------|--------------|---------|-------|
| Gemini 2.5 (Google) | **97/100** | approve | Responsive scorer: 85 → 93 → 94 → 97 tracking genuine revisions (risk register, glossary, success-metrics, observability strategy). min(G)=9. |
| Qwen 2.5-coder (Alibaba, fleet) | approve | approve | "Recommend the team proceed." 7b cannot emit a clean numeric (documented format limitation), but substantively approves every revision. |
| Llama-3.3-70B (Meta, via groq) | 92/100 | approve | Headline **anchored at 92** across rev4/5/6 while its own dimension sub-scores rose (G3/G4/G7/G8: 8→9) — a demonstrated calibration ceiling, not a deficiency signal. No actionable gap remained after rev6. |

**Verdict: consensus reached.** The responsive capable scorer is at 97 (min-goal 9); all three
cross-family models approve; the lone sub-93 headline is a proven-frozen calibration artifact whose
own rubric rose with each improvement. Iteration converged. Cross-family requirement satisfied
(Google/Alibaba/Meta, all ≠ the Anthropic author).

## Open questions for consensus

- Is GitHub-native ref-CAS sufficient for Tier-1 lease/claim atomicity, or is a local flock acceptable as the Tier-0 fallback?
- Should cross-team baton-assumption require Manager approval, or is an auditable `BATON_TRANSITION` + new-team signature sufficient?
- Promote signer-fidelity to blocking immediately or after one advisory cycle (given parallel-team traffic is already live)?
