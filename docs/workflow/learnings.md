# Workflow Learnings (pointer index)

Thin chronological index. Full prose lives in the canonical home
[[workflow-learnings]] (`wiki/wisdom/project/research/workflow-learnings.md`) per Epic #3124 D4 —
one fact, one home, no duplicated prose. Each line points to its source ticket + the wiki entry.

## 2026-06-02

- #2617 — explicit overlap boundaries at manager handoff. See [[workflow-learnings]].
- #2626 — bound fleet calls with a timeout or guarded wrapper. See [[workflow-learnings]].

## 2026-06-07

- #2569 — never prompt the client for a credential already in local `.env`. See [[workflow-learnings]].

## 2026-06-08

- #2730 — multi-close batching is for inseparable single-diff work only. See [[workflow-learnings]].
- #2735 — advisory doc-coverage gate hid six bugs; fail-closed + spawnSync. See [[workflow-learnings]].
- #2726/#2737 — pretool hook state path + record `admin_ops.merge` after REST merge. See [[workflow-learnings]].
- #2726 — post all baton artifacts before `gh pr create`. See [[workflow-learnings]].
- #2697 — unbounded fleet calls stall the session. See [[workflow-learnings]].
- #3016 — a validator gated on an arg the caller never passes is dead code. See [[workflow-learnings]].
- #3098/#1948 — phantom completion: closed-with-prose but never merged. See [[workflow-learnings]].

## 2026-06-19

- #3121/#2716 — second phantom class: merged-but-unwired; need a wiring test. See [[workflow-learnings]].
- #3124/#3127 — drain MEMORY.md to pointers; measure with `npm run resident:budget`. See [[workflow-learnings]].

## 2026-06-23

- #3204/#2252 — stale MANAGER_HANDOFF without `worktree_branch:` bypassed #2876; authoritative latest-handoff gate added. See [[workflow-learnings]].

## 2026-06-24

- #3243/#3242 — file-editing tools on non-workspace worktree paths trigger VS Code auth dialogs on every call; use shell commands (sed -i, cat, patch) for paths outside registered workspace. See [[worktree-tool-boundary]].

## 2026-06-28

- #3290/#3284 — W2 keystone: the `baton-authority/merge` check re-derives the baton trail from GitHub truth (issue comments/labels/PR state) and Merkle-verifies the evidence digest; a stale local `admin_ops` cache can never authorize merge. See [[workflow-learnings]].
- #3315/#3290 — config-as-code ruleset must require only contexts that are *actually reported*: requiring `baton-fsm-conformance` (an advisory, `continue-on-error`, paths-filtered job named `fsm-conformance-advisory`) under a strict policy bricks every PR ("Expected — waiting for status"). Anti-recurrence: a `KNOWN_REPORTING_CONTEXTS` allowlist in the validator now rejects unreportable required contexts before live apply. Break-glass belongs at the workflow level (`merge-bypass:admin-exception` label), not as a placeholder ruleset bypass actor. See [[workflow-learnings]].

- #3315/#3284 — applying the live, required `baton-authority/merge` ruleset CONFIRMED the "would-brick-main" risk in production: the FSM modelled `MERGE` only from `status:testing`, but the documented deferred-final flow merges from `status:review`, so every deferred-final PR got `fsm-denied: illegal-transition` (real casualty: PR #3324/#3300). Fix: add a `REVIEW + MERGE` self-loop requiring `CONSULTANT_CLOSEOUT|CI_GREEN|SIGNER_INDEPENDENT|WORKTREE_MERGE_OK`. Lesson: a config-as-code gate and the FSM it enforces must be reconciled against the *documented merge state* before going live; the fix PR itself must bootstrap-merge from `status:testing`. See [[workflow-learnings]].

## 2026-06-29

- #3350 — closing the parent-close → children-terminal gap had to AVOID re-opening the #1306 false-positive class (prose `#N` in the EPIC body). Resolution: realise the "timeline cross-ref union" as a **child-side** signal — a cross-ref child counts only when *its own body* asserts parentage (`Refs Epic #N`, the #1432 convention) — which is structured, evaluated over live open issues, and reuses linkage the harness already trusts. Two opposite false-positive/false-negative pressures (#1306 vs #3021) reconcile at the child boundary, not the epic boundary. See [[workflow-learnings]].
- #1434 — an **absolute** readability warning-count gate is a drift magnet: the threshold was ratcheted 420 → 475 → 486 until it sat exactly at the live count, so any unrelated PR adding one warning re-broke it (admin-overrides + `PUSH_GATES_BYPASS`, cycles 4–7). Fix is a **diff-aware** gate that fails only on net-new warnings in the files a PR actually changes (Stage 2 of the rollout model). A diff-aware gate is also strictly better at *preventing* drift than an absolute ceiling — the baseline can only grow through a changed file, which the per-file delta always catches. Key resilience requirement: when the diff base is unavailable (shallow CI checkout — `actions/checkout` defaults to `fetch-depth: 1`), degrade to the absolute ceiling, never crash or fail open. See [[readability-commenting-governance]].

## 2026-06-30

- #1617 — Epic AC wording vs shipped disposition is a distinct trap from AC checkbox-truthfulness: Path D (advisory-first then replay-eval promotion) is a valid rollout, but an Epic closing with an `enforce X` AC *ticked* while only the advisory phase shipped over-claims enforcement. Fixed with an advisory `epic-ac-disposition-check` validator on the wording-vs-disposition axis (not checkbox state, not child-refs). Triage also found two of the ticket's six original ACs had gone stale (retroactive edits to six closed terminal tickets; a cross-team note on an already-closed ticket) — re-scoped to forward-going-only, validated by a free cross-model panel (Groq/Llama + Mistral APPROVE) rather than the client, per the closed-ticket-immutability rule. See [[workflow-learnings]].
- #3428 (Epic #3425 P1-a) — adding a field to `baton-artifact-schema.js` as `req:true` is a back-compat hazard: `buildArtifact` is replayed over a committed corpus of 17 *historical* real artifacts (byte-identity regression guard) and a `req` field throws on every entry predating it. The schema file already encodes the fix as precedent (worktree fields kept OPTIONAL "so the historical replay-eval corpus still builds"). Correct pattern for a new per-review-point field (`flaws_recognized`): add it `block:true` / not-`req` and enforce live-artifact requiredness in the **validator** (the real PR enforcement surface), which also lets it ship advisory. A free cross-model panel (3/3 OPTION B) confirmed rewriting historical `expected` bytes would corrupt the regression guard. See [[workflow-learnings]].
- #3429/#3431/#3432 (Epic #3425 detection layer) — wiring a new checkpoint into the `baton-artifact-builder` emit seam: keep the emission OFF the pure `buildArtifact` path and inside the already-impure `emitBuildDecision`, returning the checkpoint result additively (`{...event, checkpoint}`) so the cross-runtime byte-identity invariant is untouched. Reuse-first beat green-field: F2/F5 sensors emit through the existing `emitFriction` (#3165) and escalate via the existing `incidents.jsonl` recurrence count, and #1855 was *demoted* to a backstop sharing the one `anneal-decision-detector` core rather than forking a second recognition model. Stress specs must construct exotic/bidi fuzz chars from `String.fromCharCode(0x202e)` escapes, never literal bytes (keeps the spec ASCII, dodging the binary-diff + trojan-source guards). See [[workflow-learnings]].
- #3430 (Epic #3425 P1-c) — the #3424 "stray worktree" false-positive is fixed by probing **content-equivalence, not commit-reachability**: `git cherry <main> <branch>` marks a commit `-` when an equivalent change is already in main (squash/cherry-pick) and `+` when genuinely unmerged, so a branch is residual only when any `+` line remains. `git branch --merged` / reachability would mis-flag every squash-merged branch (the #3424 reflex). Probe-design rules that generalize: confidence-tag each probe (pure-local `high` = blocking-eligible; network `medium` = advisory-only, dodging API-latency false-positives), budget each probe and fail **open** to `inconclusive` + a `probe_error` row (never fabricate a contradiction when the probe can't run), and redact probe output before emission. See [[workflow-learnings]].
