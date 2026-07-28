---
title: "Security-surface verify-then-flip lane — Phase-0 research & design"
ticket: 3790
epic: 3789
lane: docs-research
ac: [AC-R1, AC-R2, AC-R3, AC-R4, AC-R5]
last_updated: 2026-07-13
status: ratified
cross_family_receipt: e229fbbbd50b6e06
rubric_version: g1-g10-v3
related:
  - "[[epic-3789-security-surface-verify-lane]]"
  - "[[epic-3041-copilot-byok-pr3050]]"
  - "[[route-self-post-closeout-to-consensus]]"
  - "[[baton-merge-gate-checklist]]"
signers:
  manager: "Orla Mason (claude-code:opus@anthropic)"
  consultant: "cross-family panel (groq:llama-3.3-70b / mistral:mistral-large / sambanova:llama-3.3-70b)"
---

# Security-surface verify-then-flip lane — Phase-0 research & design

**Problem restated.** A "hold for human" fires today when a change is simultaneously **(a) unverifiable in the headless executor**, **(b) irreversible once merged to protected `main`**, and **(c) a novel security surface**. When all three coincide — the canonical case being Epic #3041 / PR #3050, a complete, 44/44-unit-green Copilot-BYOK DPoP↔HAMR↔MCP auth bridge whose *live* handshake cannot be exercised headless — the change dead-ends at an unscheduled manual step and rots as an abandoned PR. This deliverable designs a lane that **dissolves each of (a), (b), (c) separately** so the blanket stop becomes rare, risk-based, and evidence-backed, without weakening the security posture. It is the research-first gate for Epic #3789; **no Phase-1 child may be authored until this passes iterative cross-model consensus ≥93/100 vs G1–G10 with min(G)≥7.**

This is not a proposal to remove a gate. Defense-in-depth is *strengthened*: bespoke-and-unverifiable logic is replaced by conformance-verified standard flows (removes **c**), the previously-unrunnable negatives become CI-runnable against a local mock (removes **a**), and an irreversible merge becomes a reversible flag state with automated rollback (removes **b**). The blunt binary stop is replaced by intelligent, monitored, threshold-automatable gating — the 2025–26 progressive-delivery consensus.

---

## 1. AC-R1 — `lane:security-surface` baton contract

### 1.1 Lane classification and registration

`lane:security-surface` is registered as a **`full`-severity** lane (4-role baton: Manager → Collaborator → Admin → Consultant) because it mutates a security-relevant runtime surface and therefore must carry the `cross_family_receipt` independence requirement (CLAUDE.md Hard Rules, #3672/#3679). Registration touches exactly three source-of-truth surfaces already identified in the harness:

- `scripts/global/lane-enum.js` — add to `LANES` and to `LANE_META` with `{ severity: 'full', collab: true, admin: true }`; **not** added to `LIGHTWEIGHT` (it never skips collab/admin).
- `scripts/global/label-manifest.json` — add to the `lane:*` group (color/description) so the provisioner + label-lint auto-sync.
- Prose parity: the `lane:` enumerations in `instructions/role-baton-routing.instructions.md` and `CLAUDE.md` §MANAGER_HANDOFF schema (checked by `governance-rule-parity.js`).

### 1.2 State machine

The lane reuses the standard baton states but **inserts a post-merge verification plane** absent from `lane:code-change`:

```
SCOPED → IMPLEMENTED → REVIEWED → MERGED_DARK → CANARY → VERIFIED_LIVE → FLIPPED → RETIRED
                                       │             │            │
                              (flag default-OFF)  (scoped)  (auto-rollback on regress → MERGED_DARK)
```

- **MERGED_DARK** is a *terminal-safe* state: the code is on `main` behind a default-OFF, fail-closed flag. A lane instance may legitimately close here (ticket done, feature dormant) — landing dark is itself a shippable outcome. This is the state that dissolves property (b).
- **CANARY / VERIFIED_LIVE** are post-merge and *do not block the merge*; they gate the *flag flip*, not the code landing.
- **FLIPPED** (flag → on for 100%) is the only state that may require the retained human touchpoint, and only when the change is *also* a design-direction decision (see §4). When it is purely a workflow/governance flip backed by green canary evidence, it is threshold-automatable.

### 1.3 Required evidence artifacts (extend `baton-artifact-schema.js`)

The lane adds artifacts to the existing schema without breaking the six standard ones:

- **MANAGER_HANDOFF** (existing) + new optional block `security_surface_classification`: which of (a)/(b)/(c) apply, and the chosen flag name + scope (§3).
- **COLLABORATOR_HANDOFF** (existing) + new required block `ephemeral_verification_evidence`: the four negative-test results from the local mock harness (§2), each `test → PASS|FAIL → transcript_sha256`. This is the artifact that converts "can't verify here" → "verified in an ephemeral env, evidence attached."
- **ADMIN_HANDOFF** (existing) + new required fields `flag_name`, `flag_default` (MUST be `off`), `fail_closed_proof` (path/line of the disabled-path fallback), `merge_reversibility` (= "flag-flip"). `cross_family_receipt` remains required (full severity).
- New artifact **CANARY_REPORT**: `flag_name`, `canary_scope` (single non-critical runtime id), `window`, `metrics_observed`, `regression_signal` (none|<signal>), `auto_rollback_fired` (bool), `verdict` (HOLD_DARK|PROMOTE). Emitted post-merge; consumed by the flip decision.
- **CONSULTANT_CLOSEOUT** (existing) + `residual_risk_after_dark` and, if flip deferred, `flip_decision_owner` (= `client` only when §4 design-direction applies; else `auto:canary-threshold`).

### 1.4 Gate predicates

- **G-merge (to land dark):** `flag_default == off` ∧ `fail_closed_proof` present ∧ `ephemeral_verification_evidence` all-PASS ∧ `cross_family_receipt` verifies (≥2 non-authoring families). Note: G-merge deliberately **does not** require live verification — that is the whole point.
- **G-flip (to promote to 100%):** `CANARY_REPORT.verdict == PROMOTE` ∧ `auto_rollback_fired == false` ∧ (`flip_decision_owner == auto:canary-threshold` ∨ explicit client design-direction sign-off per §4).
- **G-retire:** flag removed within N days of stable FLIPPED (§3.4) — flags are debt if they outlive their purpose.

---

## 2. AC-R2 — Local mock OAuth 2.1 / MCP resource-server conformance harness ($0 / Tier-0)

### 2.1 Rationale

The four security negatives that unit mocks skip — forged proof, replay, wrong audience, key leak — are exactly the behaviors that make a security surface "unverifiable headless." They are unverifiable only because there is no *counterparty* to reject a bad request. The harness supplies that counterparty as a **local Node process** implementing the minimum of the MCP 2025-11-25 authorization surface: an OAuth 2.1 Resource Server exposing **RFC 9728 Protected Resource Metadata** (`/.well-known/oauth-protected-resource`) and enforcing **RFC 8707 Resource Indicators** (token-audience validation), with **DPoP** sender-constraint verification. No cloud, no external calls → **$0, Tier-0**, satisfying G3/G5.

### 2.2 Conformance harness design

A single-file `scripts/global/mock-mcp-resource-server.js` started by the lane's test step, plus a driver in the collaborator's verification. It implements just enough to *reject* correctly:

- Serves `/.well-known/oauth-protected-resource` (9728 PRM: `resource`, `authorization_servers`, `bearer_methods_supported`, `dpop_signing_alg_values_supported`).
- Verifies presented DPoP proof (Ed25519 signature over method+URL+nonce+ath) and the bound access token's `aud`.
- Exposes a protected `/mcp` echo endpoint that returns `200` only for a fully valid, correctly-audienced, fresh, correctly-signed request; otherwise the specific `401/403` per the spec's error taxonomy.

### 2.3 The four mandatory negative tests

Each returns `PASS` iff the mock **rejects** the malformed request with the correct status; the transcript is hashed into `ephemeral_verification_evidence`:

1. **Forged-proof rejection** — DPoP proof signed by a non-publisher key → expect `401 invalid_token` (proof signature invalid). Guards OWASP Agentic **OA3 (identity/impersonation)**.
2. **Replay rejection** — a previously-accepted DPoP proof reused (same `jti`/nonce) → expect `401` (replay). Guards **OA8 (insecure comms)**.
3. **Wrong-audience rejection** — valid token minted for resource `X` presented to resource `Y` → expect `403 invalid_target` (RFC 8707 audience mismatch; defeats confused-deputy / token-passthrough).
4. **No-key-leak** — assert the client bridge never writes the private key / raw token to logs, error bodies, or the governance ledger; scan the emitted transcript + process stderr for the key material fingerprint → expect `PASS` (absent).

### 2.4 Why a mock and not a contract test of the real handshake

Per Pact guidance, you do **not** build bespoke test harnesses around a *standard, stable* auth handshake — you rely on the vetted library for the positive path and test only *your* integration and the *negative* security properties. The mock exists to exercise rejection paths deterministically at $0, not to re-implement or re-certify OAuth 2.1 itself. (This is why §4's Layer-1 migration matters: the more of the flow is standard-library, the smaller the surface this harness must cover.)

---

## 3. AC-R3 — Dark-launch + canary-with-auto-rollback governance

### 3.1 Flag default-OFF + fail-closed (dissolves property b)

The lane lands code behind a **default-OFF opt-in flag** using the harness's established inverse idiom `MEGINGJORD_<AREA>_ENABLED` (cf. `MEGINGJORD_HAMR_ENABLED`), read as `process.env.MEGINGJORD_<AREA>_ENABLED === '1'`. Absence = feature OFF = fail-closed (the surface simply does not run; no degraded-but-live state). Merging disabled, fail-closed code to `main` is **reversible** (rollback = leave the flag unset / flip to `0`) and is **not security-weakening** — nothing new executes until an explicit, evidence-gated flip.

### 3.2 Flag-scope decision (resolves audit finding C-8)

The immediate #3050 win must **not** reuse the global `MEGINGJORD_HAMR_DISABLED` opt-out: that flag disables *all* HAMR Tier-2 functionality for the session (mailbox, cron, cache push, governance bundle, substrate health), so dark-merging the MCP adapter through it would collaterally disable unrelated, already-shipped subsystems. **Decision: introduce a narrow, adapter-scoped opt-in flag** `MEGINGJORD_MCP_ADAPTER_ENABLED` (default-OFF) read only inside `hamr-mcp-adapter.js`, orthogonal to the global HAMR kill-switch. Register it in `scripts/global/baton-bypass/env-flag-classifier.js` as an opt-in enabler (not a bypass), and emit a non-silent advisory when absent so the OFF state is observable (G8), never silent.

### 3.3 Canary + auto-rollback (makes the flip reversible and monitored)

Post-merge, promotion is **canaried**: enable the flag for exactly one non-critical runtime (a single fleet node / one Copilot session class), observe a bounded window, and **auto-rollback on regression** — the Argo Rollouts / Flagger `AnalysisTemplate` pattern: define success metrics (error-rate, auth-reject-rate anomaly, latency budget) and a rollback predicate; on breach, flip the flag back to `0` automatically and emit `event:canary-rollback`. The canary run **is** auditable change-management evidence (who/when/metrics), recorded as the `CANARY_REPORT` artifact (§1.3). Rollback is a flag write, not a revert commit → seconds, not a breaking-change recovery.

### 3.4 Flag lifecycle / retirement (flags must not become debt)

Every lane-created flag carries a lifecycle record from birth: `created (ticket, default:off)` → `canary` → `flipped (100%, date)` → `retire-by (flipped + N days)`. A `flag-lifecycle-lint` check (extends the existing `env-flag-classifier` taxonomy) fails CI when a flag is past `retire-by` and still referenced, forcing either code-path removal (feature is now unconditional) or an explicit extension with justification. This closes the classic progressive-delivery failure mode where dead flags accumulate as branching debt.

---

## 4. AC-R4 — Layer-1 MCP-standard-migration evaluation (client design-direction decision)

**This section surfaces an option and a recommendation; it does NOT pre-decide.** Migrating HAMR `/mcp` from the hand-rolled Ed25519 DPoP bridge to the standard MCP OAuth 2.1 architecture is a genuine design-direction decision reserved for the client (a retained human touchpoint per the Goal Constitution's carve-outs). Layers 2 and 3 (this deliverable's mock harness + dark-launch governance) proceed autonomously via consensus; Layer 1 is presented for the client to choose.

### 4.1 Option A — Adopt the standard (RFC 9728 PRM + RFC 8707 Resource Indicators + vetted OAuth 2.1 library)

- **Pros:** the security-critical logic becomes **conformance-verified**, not bespoke; audience-binding and no-token-passthrough / confused-deputy protections come from the spec, not from local code; the §2 mock harness shrinks to integration + negatives; future MCP clients interoperate without custom DPoP knowledge (G9). Aligns HAMR with the 2025-11-25 spec that the ecosystem is converging on.
- **Cons:** migration cost; a vetted library dependency (supply-chain surface — mitigated by pinning + `github-actions-security-hardening`); requires standing up a separated authorization server (or an embedded AS profile) that HAMR does not have today.

### 4.2 Option B — Retain the bespoke Ed25519 DPoP bridge

- **Pros:** zero migration; already implemented and 44/44 unit-green; no new dependency.
- **Cons:** the security-critical handshake stays bespoke and therefore carries a permanently larger unverifiable surface; every future security reviewer must re-reason the custom flow; diverges from the standard the ecosystem is standardizing on (interop debt, G9).

### 4.3 Recommendation

**Recommend Option A (standard migration), sequenced *after* the lane exists.** Rationale mapped to goals: it is the single highest-leverage move to permanently shrink property (c) (the unverifiable surface), it strengthens G4 (security via conformance) and G9 (interop), and it reduces long-run G10 (maintenance) cost. **But** it is explicitly the client's call and is **not** on the critical path — the lane (Layers 2+3) delivers the autonomy win with *either* option, because dark-launch + mock-negatives + canary make even the bespoke bridge safely landable. Sequence: build the lane → apply it to #3050 with Option B (fast unblock) → offer Option A as a follow-on Epic the client may greenlight.

---

## 5. AC-R5 — Phase-1 child decomposition + sequencing

Authored by the Manager **after** this deliverable passes consensus. Each child cites its Phase-0 source section. Proposed set and order (dependency-sorted):

1. **C1 — `lane:security-surface` scaffolding** (from §1): add lane to `lane-enum.js` + `label-manifest.json` + prose parity; extend `baton-artifact-schema.js` with the new blocks/artifacts (`ephemeral_verification_evidence`, `CANARY_REPORT`, ADMIN flag fields). *Foundational; no dependency. Tractable now.*
2. **C2 — narrow default-OFF flag helper + classifier registration** (from §3.1–3.2): `MEGINGJORD_MCP_ADAPTER_ENABLED` read-path in `hamr-mcp-adapter.js`, `env-flag-classifier.js` entry, non-silent-OFF advisory. *Depends on nothing; unblocks the immediate #3050 win.*
3. **C3 — local mock OAuth 2.1/MCP resource-server conformance harness** (from §2): `mock-mcp-resource-server.js` + the four negative tests wired into the collaborator verification. *Depends on C1's evidence-artifact schema.*
4. **C4 — canary + auto-rollback signal + `flag-lifecycle-lint`** (from §3.3–3.4): `CANARY_REPORT` emitter, `event:canary-rollback`, retire-by lint. *Depends on C1 + C2.*
5. **C5 — apply the lane to #3050 as the regression anchor** (from §4.3, Option B): merge #3050 dark under `MEGINGJORD_MCP_ADAPTER_ENABLED=off`, run the mock negatives, canary one session class. *Depends on C1–C4; belongs to Epic #3041's baton, unblocked by this Epic.*

**Independent immediate win (not gated by Phase-1):** C2's flag alone lets #3050 land dark; recommend shipping C1+C2 first, then #3050 dark-merge on #3041's baton, then C3/C4 to complete the verification plane, then optionally the Option-A migration Epic if the client greenlights §4.

---

## 6. Cross-cutting instrumentation — throughput, observability, interop, maintainability

These properties are first-class lane requirements, not afterthoughts.

### 6.1 Throughput (G7) — the lane retires an entire stall *class*

The abandoned-PR stall is not a one-off: any future security surface hits the same wall, so each is a latent multi-week stall. Concrete metric for the triggering case: PR #3050 has been open **19 days** with implementation complete and 44/44 unit-green — pure queue time, zero remaining work. The lane converts that 19-day human-gated tail into a **same-baton dark-merge** (G-merge predicates are all machine-checkable, §1.4), so time-to-land drops from *unbounded* (waiting on an unscheduled human) to *one CI cycle*. Lane instances are **independent and parallelizable** — N security surfaces can be in MERGED_DARK/CANARY concurrently without serializing on a human, because the only shared human touchpoint (§4 design-direction) is optional and per-surface. A `dark-merge-throughput` counter (surfaces landed dark / week) makes the reclaimed throughput measurable rather than asserted.

### 6.2 Observability (G8) — nothing dark is invisible

Every state transition emits a structured, ledger-backed signal; the OFF state is never silent:

- **`event:merged-dark`** `{ticket, flag_name, commit, fail_closed_proof}` — appended on land.
- **`event:canary-start` / `event:canary-rollback` / `event:canary-promote`** `{flag_name, scope, window, metrics}` — the canary trail (also the `CANARY_REPORT` artifact, §1.3).
- **A standing G8 gauge `dark-not-flipped-inventory`** — every flag currently in MERGED_DARK/CANARY (never FLIPPED), with age. This is the observability that prevents "landed dark and forgotten": a dark-merge that never flips or retires surfaces as aging inventory, not silence.
- **Non-silent OFF advisory** (§3.2) emitted whenever the adapter runs with its flag absent, so "the feature is off" is always an observed, logged fact.
- **Canary metrics schema** (fixed keys: `error_rate`, `auth_reject_anomaly`, `p95_latency_ms`, `window_s`) so canary evidence is machine-comparable across surfaces, feeding the auto-rollback predicate deterministically.

### 6.3 Interoperability (G9) — standard-aligned and substrate-agnostic

- The mock and (recommended) Layer-1 target the **published MCP 2025-11-25 authorization spec** (RFC 9728 PRM, RFC 8707 Resource Indicators, DPoP) — so any standards-conformant MCP client interoperates with a lane-verified surface without bespoke DPoP knowledge, and any standards-conformant resource server can be dropped in for the mock.
- The lane composes with the **existing** baton/CI machinery (reuses `baton-artifact-schema.js`, `cross-family-receipt.js`, `env-flag-classifier.js`, `governance-rule-parity.js`) — no parallel governance track, so it interoperates with every current gate.
- Flag/canary signals use the harness's existing `event:*` + JSONL-ledger conventions, so existing observability/anneal consumers ingest them unchanged.

### 6.4 Maintainability (G10) — additive, dependency-free (Layers 2–3), self-retiring

- Layers 2 and 3 add **zero runtime dependencies**: the mock is a single-file local Node process; the flag is one `process.env` read; the canary emitter reuses `event:*`. Only Layer-1 (client-decided, §4) introduces a vetted library, pinned per `github-actions-security-hardening`.
- The `flag-lifecycle-lint` (§3.4) makes flags **self-retiring** — CI fails when a flag outlives its `retire-by`, so dark-launch flags cannot accrete as permanent branching debt (the canonical progressive-delivery maintenance failure).
- The lane is expressed as **extensions to existing source-of-truth files** (three lane registrations, additive schema blocks) rather than a new subsystem — nothing to keep in sync beyond the parity check that already exists.

## Goal-lens self-assessment (rubric g1-g10-v3; provisional, pending panel)

- **G1 Governance** — adds a *stronger*, evidence-backed gate (mock-negatives + receipt + canary), never a bypass; MERGED_DARK is fail-closed. Provisional 9.
- **G2 Quality** — conformance-verified over bespoke; four explicit security negatives. Provisional 9.
- **G3 Zero-cost** — mock is local Node, panel is free-tier fleet, canary reuses existing runtimes. Provisional 10.
- **G4 Privacy/Security** — no-key-leak test, audience-binding, DPoP replay defense; recommends standard migration. Provisional 9.
- **G5 Portability** — Tier-0 local mock, env-flag idiom already portable. Provisional 9.
- **G6 Resilience** — auto-rollback = seconds; MERGED_DARK never degrades live. Provisional 9.
- **G7 Throughput** — retires a stall *class*; 19-day #3050 tail → one CI cycle; parallelizable lane instances; `dark-merge-throughput` counter (§6.1). Provisional 9.
- **G8 Observability** — `event:merged-dark`/`canary-*`, standing `dark-not-flipped-inventory` gauge, fixed canary-metrics schema, non-silent OFF advisory (§6.2). Provisional 9.
- **G9 Interop** — targets published MCP 2025-11-25 spec; composes with existing baton/CI + `event:*`/ledger conventions (§6.3). Provisional 9.
- **G10 Maintainability** — zero runtime deps (Layers 2–3), self-retiring flags via lifecycle-lint, additive extensions to existing SoT files (§6.4). Provisional 9.

min(G) provisional = 9 (≥7). Aggregate provisional ≈ 90 — **to be replaced by the recorded cross-family panel score below.**

## Cross-family consensus verdict (recorded)

Iterative $0 cross-family panel (free-tier fleet; anthropic authoring family excluded):

- **Round 1** — groq (meta) 89 PARTIAL, mistral (mistral) 89 PARTIAL. Gap: G7/G8/G9/G10 under-specified. → deliverable revised (added §6 throughput/observability/interop/maintainability instrumentation).
- **Round 2** — groq (meta) 96 ACCEPT, mistral (mistral) 95 ACCEPT, sambanova (meta) 96 ACCEPT. **Mean 96/100, min(G)=8 (≥7), 2 distinct non-Anthropic families, unanimous ACCEPT.**

**ACCEPT — cross-family panel (groq:llama-3.3-70b + mistral:mistral-large + sambanova:llama-3.3-70b) — 96/100 — min(G1..G10)=8 ≥7 — receipt `e229fbbbd50b6e06`** (kind=review, `verifyReceipt` → `cross-family-consensus-verified`, families [meta, mistral], panel 2, ledger chain intact).

Gate ≥93/100 ∧ min(G)≥7 ∧ ≥2 families: **PASS.** Phase-1 children may now be authored.
