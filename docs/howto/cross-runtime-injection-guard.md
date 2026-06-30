# Cross-runtime state-injection guard (#1936)

**Epic:** #3355 · **Module:** `scripts/global/cross-runtime-injection-guard.js` · **Corpus:** `tests/fixtures/cross-runtime-injection-corpus.json` · **Self-test:** `node scripts/global/cross-runtime-injection-guard.js --self-test`

## Why (the hypothesis the Epic got wrong)
Epic #3355 predicted #1936 was superseded by the #3021 cluster. Phase-0 (#3368) **refuted** that: #3033/#3035/#3036/#3037 hardened only the **LOCAL** runtime (atomic file writes, local lease cache, local worktree preflight, local event attribution). They never validated **cross-runtime** env/artifact provenance or reconciled leases against the authoritative source. This guard closes the residual.

## The four vectors
| Vector | #3021 left | This guard |
|---|---|---|
| **1. Lease state** | gate reads a LOCAL file; #3033 AC5 GitHub-native reconcile not in the gate path | `reconcileLease(local, authoritative)` — authoritative wins; flags any authoritative lease missing locally (Team A's lease made visible to Team B) |
| **2. Hook context** | `emitV3` trusts `HAMR_TEAM`/`MEGINGJORD_TEAM` env unvalidated; `state_store.py` reads `MEGINGJORD_SESSION_ID` unvalidated | `validateHookEnv(env, {knownTeams})` — team must be enrolled; session id must be a safe token (rejects shell-metacharacter injection) |
| **3. Signer aliases** | substrate-first exists in `signer-alias.js` but the builder doesn't pass substrate; #2674 tests drift not injection | exercised against `signer-alias.js`; a forged-substrate signer is caught at validation by Vector-4's enrollment check (defense-in-depth, no risky edit to the shared builder) |
| **4. Baton artifacts** | validators check schema/format only; no team-sovereignty | `validateArtifactSovereignty(artifact, {prTeam, resolveEnrolledAlias})` — artifact team must match the PR team; signer must be the registry-enrolled alias for (team, role) |

## Design
All detectors are **pure + dependency-injected** (the authoritative lease set and the enrolled-alias resolver are passed in), so the adversarial corpus runs with no network or registry I/O. Composes with the existing conflict-prevention chain (#1854/#1855/#1827/#1876) rather than forking it. Ships **advisory** (each detector returns findings; promotion to blocking is replay-eval-gated). G4: findings carry no raw secret/env value — enrollment is checked against the committed registry.

## Tests
`tests/cross-runtime-injection.spec.js` (corpus: every forged case detected + every clean case passes; per-vector asserts; Vector-3 substrate-first wiring) + `tests/stress-cross-runtime-injection.spec.js` (G6: 500 randomized intruder teams / 200 injected session payloads / 300 forged leases all detected; G7: `auditAll` p99 < 25ms). Self-test registry entry `cross-runtime-injection` runs the corpus and fails if any forged case is undetected.
