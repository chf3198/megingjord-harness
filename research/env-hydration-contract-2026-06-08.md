# Phase-0: Environment hydration contract + secret-storage strategy (#2292, Epic #2291)

Status: Phase-0 research. Lane: docs-research. Test strategy: peer-review.
Maps to Epic #2291 AC-R1–AC-R8 (deliverables D1–D8 in #2292).

## Problem (recurrence-anchored)

The harness repeatedly prompts the client for a credential **already present in the
approved local `.env`** (Tavily key 2026-05-27 #2569; recurring per `[[feedback_review_dispatch_env_and_freecloud_failover]]`).
Root cause is not a missing key — it is that **environment hydration is not guaranteed or
consistent across entrypoints**. A fresh session that never ran `set -a; . ./.env` sees zero
keys, so a consumer that reads `process.env` directly concludes "no key" and either prompts
the client (G1/G4 violation) or wrongly declares "no review substrate", defeating **G3** (the
fleet + free-cloud zero-cost lanes become unreachable). This Phase-0 converts that observation
into a hydration contract + storage recommendation before any Phase-1 code.

## D1 — Entry-point inventory (AC-R1; grep-grounded 2026-06-08)

Credential-consuming surfaces (`process.env.*_API_KEY|_TOKEN|_SECRET|_KEY|PASSWORD`):

| Surface class | Count | Examples |
|---|---|---|
| JS credential consumers (scripts/hooks/cloudflare/dashboard) | **28** | `agent-signature.js`, `free-router.js`, `github-mcp-dispatch.js`, `substrate-health.js`, `wiki-llm.js` |
| Python hooks reading env (`os.environ`/`getenv`) | **16** | `hooks/scripts/*.py` |
| Shell entrypoints | 3 | `hamr-activate.sh`, `hamr-teardown.sh`, `hamr-deploy.sh` |

## D2 — Hydration map (AC-R1/AC-R2): four mechanisms, not one

| Mechanism | Files | Precedence | Redaction (G4) | Opt-out |
|---|---|---|---|---|
| Canonical shim `loadLocalEnvOnce` (#2645) | **5** (cascade-dispatch, free-cloud-dispatch, hamr-provider-wrapper, credential-availability, +shim) | fill-don't-override (`process.env` wins) | yes — names-only audit via `log-redaction.js` | `MEGINGJORD_NO_DOTENV=1`, path via `MEGINGJORD_DOTENV_PATH` |
| Ad-hoc `require('dotenv')` | **14** | dotenv default (no override) — but per-file, undocumented | none guaranteed | none |
| Shell `set -a; . .env` | 3 | shell-export (overrides) | none | none |
| None / inherited shell env only | **17 consumers** | n/a — relies on caller having exported | n/a | n/a |

## D3 — Drift report (AC-R2) + user-visible consequence

1. **17 of 28 JS consumers hydrate nothing** — they read `process.env` but never load `.env`
   (`agent-signature.js`, `baton-signing.js`, `free-router.js`, `github-bundle-client.js`,
   `github-mailbox.js`, `github-mcp-dispatch.js`, `governance-drift-classifier.js`,
   `hamr-probes.js`, `ide-proxy-quality-parity.js`, `substrate-health.js`, `ticket-reconcile.js`,
   `wrangler-auth.js`, `quota-probes.js`, `wiki-llm.js`, `dashboard-api(.js/-handlers.js)`,
   `epic-close-validator.js`). On a fresh session these silently see no keys. **This is the bug class.**
2. **Three incompatible precedence rules** coexist (fill-don't-override vs dotenv-default vs
   shell-export-overrides) with no documented contract — a key can resolve differently by entrypoint.
3. **Python gap**: the canonical shim is **JS-only**. The 16 Python hooks have *no* `.env` hydration
   path; they depend entirely on inherited shell env. Cross-runtime asymmetry (G9).
4. **Redaction asymmetry (G4)**: only the 5 shim-callers route the load through name-only audit;
   the 14 ad-hoc `dotenv` loaders have no redaction guarantee.

## D4 — Goal-lens evaluation of plaintext `.env` (AC-R3)

| Goal | Verdict on current `.env` baseline |
|---|---|
| G1 Governance | **Weak** — no single contract; hydration is voluntary, so capability-dependent (cf. #2356). |
| G3 Zero Cost | **Enabler when it works** — `.env` makes fleet/free-cloud keys reachable; the *gap* is what breaks G3. |
| G4 Privacy | **Poor at rest** — plaintext on disk; mitigated only by `.gitignore` + shim redaction (partial). |
| G5 Portability | **Good** — file-based, runtime-neutral, no account/network dependency. |
| G6 Resilience | **Good** — offline-first; no external dependency to fail. |
| G8 Observability | **Poor** — no access log; only the shim emits a names-only audit line. |

Net: `.env` is **right for G5/G6 (offline, portable)** and the **G3 enabler**, but **weak on
G1/G4/G8**. The dominant defect is *inconsistent hydration*, not the store itself.

## D5 — 2026 external secret-storage synthesis (AC-R4; gemini-2.5-flash@google-ai-studio, free-cloud G3 lane)

| Option | Leak-resistance | Friction | Offline | Audit | Cost | Migration from `.env` |
|---|---|---|---|---|---|---|
| plaintext `.env` (baseline) | poor | very low | excellent | none | free | n/a |
| Encrypted file (SOPS/age/git-crypt) | good | moderate | excellent | limited | free | moderate |
| OS keychain / `op run` / libsecret | very good | low–moderate | excellent (if PM offline) | limited | free–subscription | moderate |
| Central vault (Vault/Infisical/Bitwarden SM) | excellent | high | **poor (network)** | excellent | free–high | high — **overkill for local tool** |
| Dynamic / short-lived (Vault dynamic, workload identity) | excellent | very high | **poor** | excellent | high | high — **overkill** |

Canonical sources: OWASP Secrets Management Cheat Sheet (centralization/least-privilege/lifecycle,
and the limits of env vars); 1Password `op run` (runtime-only local injection); HashiCorp Vault
static-vs-dynamic (value of short-lived creds). Vault/dynamic break G5/G6 for an offline solo/fleet
tool and are explicitly overkill.

## D6 — Recommendation matrix (AC-R5)

Weighted by the harness goal order for a **local, offline-capable, multi-runtime** harness
(G5/G6 are first-class; network-dependent stores are disqualified for the *primary* store):

- **Primary store: keep plaintext `.env` as the baseline, but behind one canonical hydration layer.**
  It is the only option that is free, offline, portable, and zero-friction. Its G4 weakness is real
  but bounded (gitignored, redaction-on-load), and the *actual* incident class is hydration drift, not
  at-rest exposure.
- **Optional hardening (opt-in, not mandated): OS-keychain / `op run` runtime injection** as a
  G4-preferred source the canonical layer can read when present — closes the at-rest gap without
  forcing a network dependency. Encrypted-file (`age`) is the team-share fallback.
- **Reject for now: centralized vault + dynamic credentials** — G5/G6 cost exceeds the threat model
  for a single-developer/small-fleet local tool (same goal-lens logic as the OA8 mesh deferral).

## D7 — Canonical hydration contract + Phase-1 plan (AC-R6/AC-R7)

**Contract (the one rule):** every credential-consuming entrypoint hydrates via a single layer
before reading `process.env`. A "credential" key matches the default suffix set
`*_API_KEY|_TOKEN|_SECRET|_KEY|PASSWORD` plus any project-configured pattern
(`config/credential-name-patterns.json`); a consumer declares its hard requirements as
`requiredKeys` (a JSON array of key-name strings). Semantics: **fill-don't-override** (real exports/CI secrets always
win), **secret-safe** (names-only audit through `log-redaction.js`, never values), **graceful**
(missing/malformed `.env` is a no-op pass-through, never a throw), **opt-out** via
`MEGINGJORD_NO_DOTENV=1`, **relocatable** via `MEGINGJORD_DOTENV_PATH`. This generalizes the
already-shipped `loadLocalEnvOnce` (#2645) from 5 dispatch files to the whole surface.

**Smallest-safe Phase-1 (rollout order, each its own child):**
1. **JS sweep** — route the 17 no-hydration consumers (and migrate the 14 ad-hoc `dotenv` loaders)
   through `loadLocalEnvOnce`. Mechanical; lowest risk.
2. **Python parity** — add a `load_local_env.py` shim mirroring the JS contract; wire the 16 hooks.
   Closes the G9 cross-runtime gap.
3. **Regression check** — a test proving an approved-source key is **visible where intended and
   absent where not** (the boundary #2291 AC missing today), plus a lint that flags a new
   credential-consumer that reads `process.env` without hydrating (prevention over reaction). Ships
   with a **one-time audit** of existing non-credential `process.env` reads, flagging names that
   would become credential-consumers if a matching `*_KEY`/`*_TOKEN` sibling were later added
   (collision-risk inventory).
4. **Opt-in keychain source** — let the canonical layer read an OS-keychain/`op` value when present,
   `.env` as fallback. Documented, not mandated.

## D8 — Closeout recommendation (AC-R8)

**Retain `.env` as the primary local store; demote nothing; do NOT adopt a vault.** The Phase-0
finding is that the recurring failure is **hydration inconsistency**, not the storage medium. Fix
the contract (one canonical layer, JS+Python parity, a visibility-boundary regression test), and
offer keychain/`op run` as opt-in G4 hardening. This is the smallest change that closes the G1/G3/G4
gap while preserving G5/G6. Any lower-priority override (e.g. adopting a network vault, which would
trade away G5/G6) is **unjustified** under the goal order for this tool shape.

## Phase-1 children to author (gated by this Phase-0 closeout + EPIC_RESCOPE)
JS-hydration-sweep (#2769) · Python-hydration-parity-shim (#2770) · hydration-visibility-regression+lint (#2771) · opt-in-keychain-source (#2772).

## Red-team hardening (iteration pass, #2775)

A cross-family adversarial rater (gemini-2.5-flash@google-ai-studio, free-cloud G3 lane) scored
the synthesis + Phase-1 plan at 78/100 baseline against G1–G10. The per-goal gaps below are closed
with concrete controls, each wired into a named Phase-1 child AC so the contract is *enforced*, not
merely recommended.

| Goal | Gap (baseline) | Control added |
|---|---|---|
| **G1 / G10** | enforcement was lint-only; nothing stops a *future* consumer reading `process.env` un-hydrated, or a new `require('dotenv')` outside the shim | **Prevention gate (#2771)**: a CI + pre-commit lint that fails on (a) a new credential `process.env.*KEY/TOKEN/SECRET` read in a file that does not call `loadLocalEnvOnce`/`load_local_env`, and (b) any `require('dotenv')`/`import dotenv` outside `load-local-env.js`/`load_local_env.py`. Prevention over reaction, capability-independent (cf. #2356). |
| **G2** | `tdd-pyramid` was unqualified per child | **Test-kind named per AC**: #2769 unit (per-consumer hydration call) + integration (fresh-env end-to-end: spawn a child process with empty env, assert keys resolve from `.env`); #2770 pytest unit + integration (subprocess with cleared `os.environ`); #2771 unit (lint rule) + integration (visibility boundary); #2772 unit + integration (keychain-present vs absent fallback). |
| **G3** | "graceful no-op on missing `.env`" did not cover a missing **required** key | **Fail-closed-not-prompt (#2769/#2770)**: when a *required* key is absent after hydration, the consumer raises/returns a typed "credential-absent" error routed through `credential-availability.js#preCredentialPromptCheck` (#2569) — it **never** prompts the client (G1/G4). Optional keys degrade silently. |
| **G4** | a bypassed shim could log a raw secret **value** | **Value-leak detector (#2771)**: a static-analysis lint rule flagging `console.*`/`logger.*`/`print(` whose argument is a `process.env.*`/`os.environ[...]` credential read, plus a runtime assertion in the shim's debug path that only names (never values) reach any sink. Complements `log-redaction.js` (which is a write-time backstop). |
| **G5 / G6** | opt-in keychain's cross-OS + offline behavior was unspecified | **Cross-OS + offline AC (#2772)**: document and test that the keychain source works on macOS Keychain, Linux libsecret, and `op run`, and that each resolves **offline** (no network round-trip); on an unsupported/locked keychain it **falls back to `.env`**, never blocks. |
| **G7** | no startup-cost budget for hydration | **Perf budget (#2769/#2770)**: a sanity assertion that one-shot hydration adds **< 10 ms** to process startup (cached after first `loadLocalEnvOnce`); regression-guarded in the integration test. |
| **G8** | no signal when hydration fails or a key is read pre-hydration | **Observability AC (#2771)**: emit a v3 `incidents.jsonl` event (`pattern_id: credential-read-before-hydration`) on a credential read with no prior hydration call, and a names-only audit line on hydration failure — auditable, attributable, never values. |
| **G9** | only JS+Python covered; future runtimes unaddressed | **Extensibility note (#2770)**: the canonical contract is specified as a 5-clause language-neutral spec (fill-don't-override, names-only redaction, graceful, opt-out env, relocate env) so a future Go/Rust runtime implements the same contract; the spec lives beside `load-local-env.js` as the source of truth. |

Net effect: every G1–G10 gap now maps to a *testable, enforced* Phase-1 control rather than prose
intent. The storage decision (retain `.env`, keychain opt-in, reject vault) is unchanged — the
hardening is about **enforcement, observability, and fail-closed safety**, not the medium.

### Iteration 2 residual findings — adjudicated (red-team discipline)

The re-score (95/100) left four residual findings; each is classified ACCEPT/REJECT:

- **ACCEPT — configurable credential-name match (#2771 AC4)**: the value/consumer lints match a
  default suffix set (`*_API_KEY|_TOKEN|_SECRET|_KEY|PASSWORD`) PLUS a project-configurable regex
  (`config/credential-name-patterns.json`), so non-suffix names (e.g. `MY_APP_AUTH`) are covered.
- **ACCEPT — explicit required-vs-optional declaration (#2769/#2770 AC5)**: each consumer declares
  its required keys (a `requiredKeys: [...]` manifest passed to the hydration call), so fail-closed
  fires only for declared-required absences; everything else degrades silently. No naming guesswork.
- **ACCEPT — subprocess secret-embedding lint (#2771 AC5)**: the value-leak rule also flags a
  `child_process`/`execFileSync`/`subprocess` call that embeds a `process.env.*`/`os.environ[...]`
  credential directly in args, recommending env-pass-through instead.
- **REJECT — central SIEM/Splunk alerting (G8)**: integrating an enterprise SIEM trades away G3
  (zero-cost) and G5 (portability — forces a network service) for no threat-model gain on a local
  offline tool. The existing `incidents.jsonl` already HAS consumers — the anneal recurrence
  detector (`workflow-resilience`) and the dashboard SSE panel (`observability.instructions.md`).
  That is the harness-native, $0, offline observability path; adding Splunk is goal-order-inverted.
- **PARTIAL — unused-`.env`-var audit (G10)**: added as an *advisory* (non-blocking) lint that lists
  `.env` keys no consumer declares; clutter-reduction only, deliberately not a gate (low value, and a
  shared `.env` may legitimately hold keys for sibling tools).

Final cross-family adversarial score (gemini, free-cloud G3 lane), converged over 3 iterations:
**78 → 95 → see #2775 closeout** — above the >93 target. The two intentional point-holds (G8 SIEM
REJECT, G10 advisory-not-gate) are goal-order-justified, not unmet gaps.
