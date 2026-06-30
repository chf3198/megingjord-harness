# Epic #3411 Phase-0 Synthesis — Uniform Cross-Orchestrator Parity Platform

> **Status**: Phase-0 research deliverable (iter 3). Merges the per-cluster feature inventories of the Megingjord harness into one coherent single-source-of-truth deliverable. Satisfies AC-R1 through AC-R6.
> **Scope**: Five named runtimes — `claude-code`, `copilot`, `codex`, `cursor`, `antigravity`. (`openclaw`, `cline`, `continue` are registry/UI placeholders, not active orchestrators — flagged where they leak into enums.)
> **Method**: Each cluster inventory was de-duplicated against the others (the same feature appears in multiple clusters — e.g. `detect-runtime.js` surfaces in instructions, scripts-global-core, deploy-registry; `cross-runtime-injection-guard.js` in scripts-global-core, deploy-registry, state-coordination). The canonical catalog below collapses these to one row each with cross-cluster citations.
> **Iter-2 changes vs iter-1** (summary; full per-section notes inline): (1) all layer/corpus tallies replaced with the authoritative counts; (2) six previously-missing governance planes promoted to first-class catalog layers (L12–L17); (3) the hook-script corpus (64 files = 61 `.py` + 3 `.sh`, excl. `__pycache__`) + ~20 `pretool_guard.py` sub-guards enumerated by function group (not claimed exhaustive — e.g. `hamr_bypass_detector.py` is cross-listed under L6 as the Py twin of `hamr-bypass-detector.js`); (4) the AC-R3 uniform-full-parity question is now **RESOLVED by client design authority** (binding adjudication) and stated once, applied consistently throughout; (5) the §1 parity-cell schema is hardened so a `structural-NA`/`waived` cell that omits a tested substitute is schema-invalid (closes the §1-vs-§5 inconsistency — `substituteTest` is required everywhere); (6) the golden re-scaffold test moves from byte-identical to **content-hash / canonicalized-normalized** comparison; (7) `scripts/global` is now a **deployable** `artifactClass` shipped to all five runtimes (cursor/antigravity reachability fix), so its features are reachable-full, never tier-down NA.
> **Iter-3 changes vs iter-2** (summary; full per-section notes inline): (A) Workstream-A path/count/map-size facts verified consistent against the disk-verified facts and retained (HAMR Worker file split at L6, `scripts/xteam-mcp/leader-election.js` path everywhere, `config/runtime-compatibility-matrix.yml` under `config/`, hook corpus 64 = 61 `.py` + 3 `.sh`, lefthook pre-push = 15, 8 canonical `agents/*.agent.md` / 11 `.claude/agents/*.md` adapters, megalint VALIDATORS map = 27 registered of 49 files, on-demand-vs-resident split backed by `scripts/global/instructions-split-classifier.js`); (B1) a **keystone cross-reference** added at the top of §1 anchoring the AC-R1 catalog to the pre-existing canonical cross-team SSoT entry point **`governance/README.md`** and its four protected invariants (verified by `scripts/global/cross-team-contract-check.js`); (B2) two previously-uncatalogued governance planes promoted to first-class catalog layers — **L18 Operator-Ownership / Client-Arbitration Enforcement Plane** and **L19 Policy-as-Code Pilot + Rubric/Review SSoT Plane**; (B3) the L6 HAMR-bypass-detector row rewritten to the **3-twin** form (JS + `hamr_bypass_detector.py` + `hamr_fleet_direct_block.py`); (B4) two L8 rows added — `inventory/team-perspectives.json` and the auxiliary `scripts/` subdirectory corpus (8 subdirs: `fleet`, `global`, `hooks`, `regression`, `tools`, `wiki`, `windows-laptop`, `xteam-mcp`); (B5) catalog totals updated **17 → 19 layers** and **~170 → ~183 features**, with `L18`/`L19` added to the machine-readable schema `layers[]` enum. Every added item was verified present on disk; no source file was modified (scratchpad-only deliverable).

---

## 0. Executive framing

The harness is a **provider-neutral governance substrate** whose *contract* (the baton, signing, ticket-first, leases, test matrix, goal-lens) is identical across all orchestrators, but whose *enforcement mechanism* is per-runtime (Claude Code = skills + `~/.claude/settings.json` hooks; Copilot/Codex = Python hooks via `global-standards.json` / `runtime-hooks.json`; Cursor = camelCase `.cursor/hooks.json`; Antigravity = User-Rules system-prompt + `.antigravity/hooks.json`). CI on GitHub Actions is the **universal backstop** that holds regardless of which orchestrator authored the work.

The core problem Epic #3411 must solve: **parity today is enumerated by hand across ~17 different registry/inventory files, 64 hook scripts (61 `.py` + 3 `.sh`), and 95 CI workflows, with no single machine-readable catalog from which all per-runtime artifacts derive.** Adding a runtime today means editing **20** disjoint surfaces (enumerated in §4) with no test that proves completeness. The keystone deliverable (AC-R1) is the canonical catalog; everything else (onboarding scaffold AC-R4, parity-test matrix AC-R5) derives from it.

**The parity model is decided (AC-R3, binding, see §2.3): UNIFORM FULL PARITY.** Every catalog feature flagged `parity: "yes"` must reach `full` on all five runtimes. Where a surface is currently *structurally unreachable* for a runtime (the canonical case is the `scripts/global/**` JS gate corpus, which `deploy.sh` never ships to cursor/antigravity), the resolution is to **MAKE IT REACHABLE** — extend `deploy.sh` / the onboarding scaffold with a `scripts` `artifactClass` that ships it — **NOT** to tier the runtime down or wave it off to CI-backstop-only. A documented, tested-substitute exception (`structural-NA`) is permitted ONLY where the surface is genuinely structurally impossible for that runtime (a platform-capability gap, e.g. `PreCompact` on camelCase runtimes), and the substitute must itself probe `full`. This overrides any "tiered parity" framing; it is non-negotiable and must not be re-litigated by Phase-1 children, the synthesizer, or any reviewer.

Three concrete, named real gaps anchor the work and recur across clusters:
- **Copilot detection (#3041-adjacent)**: Copilot has **no primary env marker** in `detect-runtime.js` PRIMARY array (`COPILOT_OTEL_*` deliberately excluded as workspace-injected); falls back to `unknown` unless `AI_AGENT`/`HAMR_TEAM` set. Under uniform-full-parity this is a gap to close (canonicalize the `AI_AGENT`/`HAMR_TEAM` detection contract as a tested path), not a tolerated quirk.
- **Antigravity enforcement plane**: state root `~/.gemini/antigravity/state/` exists in `runtime_paths.py`, and the hook config file `.antigravity/hooks.json` **does exist on disk** (~1085 bytes) — so this is `partial; wiring unconfirmed` (aligning with the §2.2 matrix), NOT an absent-file case. The open question is whether the wiring actually **fires**, not whether the file is present. HAMR_TEAM value, provider-wrapper, actor-map, side-effect ALLOWLIST, harness-self-test exemptions are all absent. All are reachable (config-file + registry adds) and must be driven to `full`.
- **Cursor Phase-2 (#3086)**: zero skill/command surface; state_store not-deployed; absent from `routing-provider-adapters.json` runtimeKinds, `scripts/xteam-mcp/leader-election.js` VALID_TEAMS, `runtime-side-effect-guard.js` ALLOWLIST, wiki paths, `governance-manifest.schema.json` targets enum, and the `orchestrator-compatibility.spec.js` KNOWN array. All `absent` (reachable via the scaffold/registry adds), not NA.

---

## 1. CANONICAL HARNESS FEATURE CATALOG (AC-R1) — REVISED

> **Revision notes vs iter-1**: (a) All layer tallies updated to authoritative counts. (b) Six previously missing governance planes added as first-class catalog layers/rows (L12–L17 below, or integrated into the most appropriate existing layer where marked). (c) Full 44-instruction set enumerated as a parity surface. (d) The hook-script corpus (64 = 61 `.py` + 3 `.sh`, excl. `__pycache__`) named and classified by function group — scripts iter-1 omitted are enumerated with purpose; `hamr_bypass_detector.py` (the Py twin of `hamr-bypass-detector.js`) is cross-listed in L6. (e) All ~20 `pretool_guard.py` sub-guards named. (f) Characterization fixes: antigravity cells distinguish `advisory-backstop-exists` from `absent`; `promotionPath` added for every `runtime-NA` feature; Cloudflare Worker surface files catalogued; visual-QA plane, semantic_router, friction-event JS/Py twins, zombie_cleanup, wiki_router/wiki_wisdom, goal-tier/actuator closed-loop all added. (g) Machine-readable catalog schema extended with new fields: `promotionPath`, `advisoryBackstop`, `subGuards`.

---

### Authoritative corpus tallies (use these numbers everywhere)

| Surface | Count | Source of truth |
|---|---|---|
| `hooks/scripts/` Python+shell files | 64 (61 `.py` + 3 `.sh`, excl. `__pycache__`) | `ls hooks/scripts/` |
| `scripts/global/megalint/` JS validators | 49 | `ls scripts/global/megalint/` |
| `scripts/global/` top-level JS | 495 | authoritative count |
| `scripts/global/` recursive JS | 591 | authoritative count |
| `.github/workflows/` YAML | 95 | authoritative count |
| `instructions/` Markdown files | 44 | `ls instructions/*.md` + `instructions/*.json` = 45 files; 44 `.instructions.md` + 1 `.json` |
| `docs/howto/` Markdown | 77 | authoritative count |
| `skills/SKILL.md` files | 42 | authoritative count |
| `.claude/commands/` Markdown | 45 | authoritative count |
| `agents/*.agent.md` canonical personas | 8 | `ls agents/*.agent.md` |
| `.claude/agents/*.md` adapters | 11 | 8 canonical + 3 adapter-only (`it.md`, `red-team.md`, `router-policy.md`) with no `*.agent.md` source |
| `tests/` spec JS top-level | 664 | authoritative count |
| `inventory/` JSON files | 17 | authoritative count |
| `config/` files | 28 | authoritative count |

---

### KEYSTONE CROSS-REFERENCE — the catalog derives from `governance/README.md` (canonical cross-team SSoT)

> **Canonical cross-team SSoT entry point**: The keystone catalog (AC-R1) is NOT the first SSoT in the harness — it must reference, and be reconciled against, the pre-existing canonical cross-team governance entry point **`governance/README.md`**. That file is the single canonical entry point for governance spanning Claude Code / Copilot / Codex runtimes and declares the **four protected invariants** that every per-runtime entry-point file must carry (verified by `scripts/global/cross-team-contract-check.js`):
>
> 1. **Team&Model signing** (`instructions/team-model-signing.instructions.md`)
> 2. **Baton order** Manager → Collaborator → Admin → Consultant (`instructions/role-baton-routing.instructions.md`)
> 3. **Ticket-first workflow** (`instructions/ticket-driven-work.instructions.md`)
> 4. **Dedicated-worktree protocol** (`research/concurrent-agent-worktrees-2026-04-24.md`)
>
> `governance/README.md` also catalogs the canonical layer chain it already governs (source-of-truth instructions → `inventory/governance-manifest.sample.json` schema layer → `scripts/global/governance-adapter-emit.js` adapter emission → `scripts/global/governance-sync-check.js` drift detection → `cross-team-contract-check.js` invariant lint) and the per-runtime entry-point adapters (`CLAUDE.md`, `.github/copilot-instructions.md`, `.codex/AGENTS.md`, `AGENTS.md`). The AC-R1 machine-readable catalog MUST treat `governance/README.md` + its four-invariant lint as the upstream SSoT it derives from, not a competing registry; the four invariants are the cross-runtime parity floor that every catalog feature is in service of.

---

### Catalog layers (revised — 19 layers)

The original 11 layers are retained and 8 new governance planes are added as first-class layers (L12–L19; L18–L19 are the iter-3 Workstream-B additions):

1. **L1 — Identity & Signing** (runtime detection, alias/registry, crypto provenance)
2. **L2 — Baton Contract & Artifacts** (roles, FSM, artifact builders, schemas, gate entry conditions)
3. **L3 — Hook / Gate Enforcement Plane** (lifecycle hooks, PreToolUse/PostToolUse/Stop/SessionStart guards, state store; the 64-file corpus — 61 `.py` + 3 `.sh` — enumerated by function group)
4. **L4 — Ticket / GitHub Governance** (label rules, linkage, epic governance, merge-evidence, ruleset)
5. **L5 — Validators (megalint + CI workflows)** (all 49 megalint validators; all 95 CI workflows)
6. **L6 — Routing / Cost / HAMR** (lane policy, cascade dispatch, provider wrapper, Worker)
7. **L7 — Knowledge: Wiki / Docs / Memory** (three-wiki typology, doc-coverage, operator memory)
8. **L8 — Deploy / Sync / Runtime Registries** (deploy.sh, manifest/verify, xteam MCP, inventory configs)
9. **L9 — Skills / Agents / Commands** (per-runtime adapter surfaces — 42 canonical skills, 45 claude commands, 8 canonical `*.agent.md` personas / 11 `.claude/agents` adapters)
10. **L10 — Observability / Dashboard** (event schema, SSE, panels, incidents/cache-stats surfaces)
11. **L11 — Resilience / Anneal / Coordination** (three-tier anneal, leases, mailbox, injection guard, side-effect guard)
12. **L12 — Goal Constitution & Decision Lens** *(NEW)* (G1–G10 harness goals, tier-graceful degradation pattern)
13. **L13 — Adaptive Goal-Health / Actuator Closed-Loop** *(NEW)* (GHS → 7-actuator tier governance engine, `actuator-engine.js`, `goal_tier_resolver.py`, `goal-tier-state.json`)
14. **L14 — Local Pre-Push/Pre-Commit Suite (lefthook)** *(NEW)* (`lefthook.yml`, 15 pre-push commands, 1 pre-commit command [`docs-check-on-package-json`], 1 post-merge command [`worktree-teardown-actuate`])
15. **L15 — Repo-Type Governance-Profile System** *(NEW)* (`hooks/governance-profiles.json`, `repo-detection.py`, `repo-standards-router` skill, profile-keyed gate sets)
16. **L16 — EDD Gate Subsystem** *(NEW)* (GOV-009; `.github/workflows/edd-required.yml`, `scripts/global/megalint/edd-required.js`, `## EDD` comment contract)
17. **L17 — Authorization-Profile Subsystem** *(NEW)* (`scripts/global/authorization-profile.js`, `config/authorization-profiles.json`, `hooks/scripts/auth_profile_enforcer.py`, `scripts/global/auth-profile-enforcer.js`)
18. **L18 — Operator-Ownership / Client-Arbitration Enforcement Plane** *(NEW — iter-3)* (machine-enforcement behind "the approver is never the client"; `inventory/operator-ownership-rules.json`, `scripts/global/operator-ownership-rules.js`, `scripts/global/operator-ownership-eval.js`, `scripts/global/delegation-phrase-lint.js`; JS twin of the `client_arbitration_guard.py` Stop-hook; backs Epics #3391/#3392)
19. **L19 — Policy-as-Code Pilot + Rubric/Review SSoT Plane** *(NEW — iter-3)* (Cedar policy-as-code pilot: `inventory/cedar-policies/*.cedar`, `scripts/global/cedar-pilot.js`, `scripts/global/ms-toolkit-pilot.js`; rubric SSoT + scorer: `inventory/rubric-g1-g10-v3.json`, `inventory/rubric-g1-g9-v2.json`, `scripts/global/rubric-score.js`, `scripts/global/multi-judge-prompts.js`; the machine-readable SSoT + executor behind `instructions/review-score-contract.instructions.md`)

---

### Catalog rows (revised — complete)

Notation: `P` = needs-per-orchestrator-parity flag. `SSoT file(s)` = where the canonical definition lives. `Per-runtime delta` = the kind of variance. `promotionPath` = what makes a `runtime-NA` or `partial` cell reach `full` (added for every NA/partial cell).

#### L1 — Identity & Signing

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| Runtime detector | `scripts/global/detect-runtime.js` | yes | distinct PRIMARY env markers per runtime; **Copilot has none** | Copilot: add PRIMARY marker (T2.5) |
| Team/model signature registry | `inventory/team-model-signatures.json` | yes | per-team aliasSeed, per-role ed25519 keys; cursor has aliasSeed only (no per-role keys) | cursor: add per-role keys or file signed waiver |
| Agent signature emitter | `scripts/global/agent-signature.js` | yes | resolution order branches on runtime env markers | depends on detect-runtime fix |
| Canonical signer-alias deriver | `scripts/global/signer-alias.js` | no | substrate-first; auto-corrects Copilot Auto-mode | — |
| Registry integrity hash guard | `scripts/global/registry-version.js` | no | shared; `MEGINGJORD_SKIP_REGISTRY_INTEGRITY=1` escape | — |
| Governance artifact crypto signer/verifier | `scripts/global/governance-artifact-signature.js` | no | pure ed25519 lib | — |
| HAMR baton DPoP signer | `scripts/global/baton-signing.js` | no | key-tier probe T1→T4; availability per-runtime not inventoried | — |
| GitHub actor→team map | `inventory/github-actor-team-map.json` | yes | only chf3198/cursoragent/github-actions mapped; **codex+antigravity absent** | T1.4: add codex+antigravity actor entries |
| Accountable-team resolver + backfill | `scripts/global/accountable-team.js`, `accountable-team-backfill.js` | no | 4 enrolled teams; cursor absent from ACCOUNTABLE_TEAMS | — |
| Antigravity signer advisory guard | `hooks/scripts/antigravity_signer_guard.py` | yes | advisory; feature-flagged `MEGINGJORD_ANTIGRAVITY_GUARD`; not a full gate | promote to non-advisory after Phase-1 parity |

#### L2 — Baton Contract & Artifacts

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| Role taxonomy + 11-state lifecycle | `instructions/role-baton-routing.instructions.md` | yes | substantive contract identical; enforcement mechanism differs | — |
| FSM transition table | `scripts/global/baton-fsm/transitions.js` | no | pure data; shared | — |
| FSM JS + WASM kernels | `scripts/global/baton-fsm/kernel.js`, `kernel.wasm` | no | byte-identical; Py/Go/Rust ports pending toolchain | — |
| FSM host layer / public API | `scripts/global/baton-fsm/index.js` | no | baton-signing optional fallback | — |
| Baton artifact grammar/canonicalizer | `scripts/global/baton-fsm/grammar.js` | no | parallel to evidence-loader regex (drift surface) | — |
| Evidence provenance signing | `scripts/global/baton-fsm/provenance.js` | no | ephemeral ed25519 fallback | — |
| Deterministic artifact builder + schema | `scripts/global/baton-artifact-builder.js`, `baton-artifact-schema.js` | yes | pure, but env-invariance is the parity invariant (cross-runtime byte-identical test) | — |
| Baton comment build CLI | `scripts/global/baton-comment-build.js` | yes | requires `--team-model` per runtime | — |
| PR/commit/changelog builders | `scripts/global/baton-pr-builders.js` | yes | Refs-first ordering; signer alias is runtime-sensitive | — |
| Comment-trail analyzer | `scripts/global/baton-artifact-governance.js` | no | last-of-each-type; epic-forbidden artifacts | — |
| Slot contract / builder mode | `scripts/global/baton-slot-contract.js`, `baton-builder-mode.js` | no | 3 free-text slots; env-flag rollback | — |
| Signer independence / progression parity | `scripts/global/baton-independence.js`, `baton-progression-parity.js` | no | route-invariant (defeats Copilot Auto-mode #2940) | — |
| Model-diversity rotation v1/v2 | `scripts/global/baton-team-model.js`, `baton-team-model-v2.js` | no | family rotation; waiver labels | — |
| Collaborator-handoff schema (shift-left) | `scripts/global/collaborator-handoff-schema.js` | no | mirrors megalint server rules | — |
| Server-authoritative merge evaluator | `scripts/global/baton-authority/merge-authority.js`, `evidence-loader.js`, `merkle.js` | no | GitHub-derived only; never local cache | — |
| FSM model checker (7 invariants) | `scripts/global/baton-fsm/verify/model-checker.js` | no | formal proof | — |
| Verdict event-log / terminal-reconciler / role-drift-janitor / outage WAL+replica / break-glass / env-flag classifier | `scripts/global/baton-fsm/*`, `baton-bypass/*` | no | injected IO; orchestrator-agnostic | — |
| Branch-scoped MANAGER_HANDOFF authority checks | `hooks/scripts/baton_handoff_checks.py` | yes | reads live issue comments via gh CLI; wired pretool_guard | antigravity/cursor: verify hook wiring |

#### L3 — Hook / Gate Enforcement Plane

This layer enumerates the **64-file hook corpus** in `hooks/scripts/` (61 `.py` + 3 `.sh`, excluding `__pycache__`), grouped by function. The grouped tables below are representative-by-function, not a 1:1 line-by-line listing of all 64 files; `pretool_guard.py` itself plus its ~20 sub-guards and the cross-listed `hamr_bypass_detector.py` (Py twin of `hamr-bypass-detector.js`, see L6) are included. The `pretool_guard.py` sub-guards (inline modules/functions it delegates to) are named below.

**Hook config files (per-runtime)**

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| Per-runtime hook config | `.claude/settings.json`, `hooks/global-standards.json`, `.codex/runtime-hooks.json`, `.antigravity/hooks.json`, `.cursor/hooks.json` | yes | event names not standardized: PascalCase (claude/copilot/codex) vs camelCase (cursor/antigravity); Codex `PermissionRequest`; Copilot `PreCompact`+`SubagentStart`; Cursor `beforeMCPExecution` | Cursor: extend hooks.json event coverage via T2.3 scaffold |
| Cursor hooks adapter | `scripts/global/cursor-hooks-emit.js` | yes | maps camelCase → harness taxonomy; known gaps (afterFileEdit ≠ full PostToolUse; subagentStart→session_context not subagent_inject; no PreCompact) | full PostToolUse coverage requires Cursor platform support |

**Session lifecycle hooks (8 scripts)**

| Script | Hook event | Purpose | P | Parity status |
|---|---|---|---|---|
| `session_context.py` | SessionStart | Inject governance context, wiki snippets, goal tier, routing hints | yes | wired claude/copilot/codex/cursor; antigravity unconfirmed → `advisory-backstop-exists` (User-Rules system prompt carries static context) |
| `session_start_rotate.py` | SessionStart | Rotate state files; begin new session epoch | yes | wired claude/codex; copilot/cursor/antigravity status unconfirmed |
| `hamr_activation_check.py` | SessionStart | Advisory gate: confirm HAMR activation on session start (5-runtime config-path map) | yes | wired 5 runtimes nominally; per-runtime activation-state may differ |
| `session_end_archive.py` | Stop | Archive completed session state | yes | wiring unconfirmed cursor/antigravity |
| `prune_file_history.py` | SessionStart | Prune `.claude/file-history/` entries older than `CLAUDE_HISTORY_PRUNE_DAYS` (default 7) | runtime-NA | Claude Code only (file-history is Claude-native); promotionPath: skip for other runtimes, add advisory backstop |
| `zombie_cleanup.py` | SessionStart | SIGTERM/SIGKILL orphaned playwright/node workers with >80% CPU for >5 min; logs to `~/.megingjord/zombie-cleanup.jsonl` | yes | Linux-only (`/proc`); exits 0 quietly on non-Linux (G6) |
| `canonical_main_wip_check.py` | SessionStart | Advisory check for stranded tracked WIP in canonical main checkout; non-blocking; auto-quarantine opt-in via `MEGINGJORD_CANONICAL_MAIN_ENFORCE=1` | yes | all runtimes |
| `wiki_wisdom.py` | (shared library) | Read governance wisdom pages from wiki/wisdom/; imported by other hook scripts; falls back to short defaults if pages missing | no | shared library, no direct hook wiring |

**Pre-tool / input guards (the `pretool_guard.py` dispatch chain)**

`pretool_guard.py` is the central PreToolUse dispatcher. It delegates to ~20 sub-guards. The sub-guards are:

| Sub-guard | Module | Purpose |
|---|---|---|
| Canonical-main RO enforcer | `canonical_main_enforcer.py` | Block writes to tracked files in `~/devenv-ops/` main checkout; shell-write blind spot documented |
| Canonical-main WIP check | `canonical_main_wip_check.py` | Advisory stranded-WIP detector (SessionStart + PreToolUse path) |
| Commit ticket gate | `commit_ticket_gate.py` + `baton_gate.py` | Deny `git commit` without `#N` reference; branch-scope check |
| Manager ticket gate | `manager_ticket_gate.py` | Deny tool calls when no MANAGER_HANDOFF on active branch ticket |
| Baton handoff checks | `baton_handoff_checks.py` | Branch-scoped MANAGER_HANDOFF authority verification |
| Blast-radius cap | `blast_radius_cap.py` | Config-driven cap on files edited per session |
| Planning consensus gate | `planning_consensus.py` | Fail-closed: deny tool call if linked issue lacks planning consensus (requires Node in hook env) |
| Auth profile enforcer | `auth_profile_enforcer.py` | Cap tool calls to `owner/guarded/restricted` profile capability set |
| Role tool allowlist enforcer | `role_tool_allowlist_enforcer.py` | Per-active-role allowlist of permitted tools; config-driven; fail-open |
| One-ticket-per-worktree | `one_ticket_per_worktree.py` | Deny if >1 active ticket in current worktree |
| Epic close guard | `epic_close_guard.py` | Block issue-close of Epic while any child is open; audited escape hatch `EPIC_CLOSE_OVERRIDE=1` |
| Worktree push gate | `worktree_push_gate.py` | Block push until commit step recorded in state file |
| Injection guard | `injection_guard.py` | PostToolUse: scan tool outputs against `prompt-injection-patterns.json` |
| Session anomaly detector | `session_anomaly.py` | Detect anomalous session patterns (high blast-radius, repeated auth failures) |
| HAMR fleet direct block | `hamr_fleet_direct_block.py` | Block raw `:11434` Ollama curl; redirect to dispatch scripts |
| Worktree ticket resolver | `worktree_ticket.py` | Path-derived worktree→ticket resolution (fixes #2586/#2587 active-ticket gate keying on main cwd) |
| Repo scope guard | `repo_scope.py` + `hooks/repo-scope.json` | Runtime-ordered candidate paths; scope-restrict hook enforcement |
| Live CI checks | `live_checks.py` | GitHub API: classify CI checks as pending-only/failing/green/unknown; used by pretool merge gate |
| IT bypass emitter | `it_bypass_emit.py` | Emit IT-ops bypass event to `~/.megingjord/it-bypass-usage.jsonl` (telemetry for §5 anneal threshold) |
| Task router / routing context | `task_router.py`, `routing_context.py` | Fleet cascade execution + route-context message building for userprompt_gate |

**Additional standalone PreToolUse/PostToolUse guards (8 scripts)**

| Script | Hook event | Purpose | P |
|---|---|---|---|
| `userprompt_gate.py` | UserPromptSubmit | Route user prompt through fleet cascade; inject routing context | yes |
| `goal_lens.py` | UserPromptSubmit | Apply G1-G10 goal lens to prompt; inject tier-scaled reminders | yes |
| `semantic_router.py` | UserPromptSubmit | Zero-ML, <1ms keyword-density pre-classifier across 7 intent categories (trivial-lookup, log-analysis, config-gen, …); routes to free/fleet/haiku/premium before fleet cascade runs | yes |
| `tool_activity.py` | PostToolUse | Track admin_ops (commit/push/pr_create/merge) activity via `mark_tool_activity`; feeds stop-hook admin-completion check | yes |
| `posttool_reminders.py` | PostToolUse | Post-tool governance reminders (baton state, uncommitted changes) | yes |
| `baton_event_emitter.py` | PostToolUse | Emit baton transition events to `dashboard/events.jsonl` and `~/.megingjord/incidents.jsonl` | yes |
| `subagent_inject.py` | SubagentStart | Inject governance context into subagent sessions | yes |
| `visual_qa_record.py` | PostToolUse | Record visual QA completion (URL, mode, verdict) into governance state `admin_ops.visual_qa` | yes |

**Stop/session-close guards (4 scripts)**

| Script | Hook event | Purpose | P |
|---|---|---|---|
| `stop_reminder.py` | Stop | Orchestrates stop-hook logic: admin completion check, uncommitted changes, wiki pending, client-arbitration detection | yes |
| `stop_checks.py` | Stop (library) | Admin completion verification (`check_admin_ops`), uncommitted code detection, post-merge messages, wiki pending messages | yes |
| `client_arbitration_guard.py` | Stop | Detect client-arbitration leakage (assistant text requesting human approval for operator-scope decisions); emits incident | yes |
| `anneal_decision_session_end.py` | Stop | Audit session transcript for unrecorded anneal decisions; emits Tier-1 event if flaw recognized without decision | yes |

**PreCompact guards (1 script)**

| Script | Hook event | Purpose | P | promotionPath for NA |
|---|---|---|---|---|
| `precompact_anchor.py` | PreCompact | Re-inject governance anchor into conversation before compaction | runtime-NA for cursor/antigravity | Cursor/Antigravity have no PreCompact event; substitute: periodic anchor re-injection at configurable Bash interval (must be itself tested to count as `full` in parity matrix) |

**State & persistence layer (5 scripts)**

| Script | Purpose | P |
|---|---|---|
| `state_store.py` | Read/write per-runtime governance state JSON; atomic IO; `reset_on_branch_change` | yes |
| `governance_state.py` | `ensure_state()` / `save_state()` helpers; state schema definition | yes |
| `atomic_io.py` | `flock`-based atomic read/write; concurrency-safe | no |
| `runtime_paths.py` | Per-runtime state-root, hook-scripts, wiki-candidates path resolution | yes |
| `runtime_session_register.py` | Register active session in runtime session registry (only claude-code wires SessionStart registration) | yes |

**Identity / role helpers (4 scripts)**

| Script | Purpose | P |
|---|---|---|
| `github_role_resolver.py` | Derive active baton role from live GitHub issue labels; feature-flagged `MEGINGJORD_DERIVE_ROLES_FROM_GH=1`; stale-cache fallback 300s | no |
| `antigravity_signer_guard.py` | Advisory: detect Antigravity-team signer commits landing on main; feature-flagged `MEGINGJORD_ANTIGRAVITY_GUARD` | yes |
| `load_local_env.py` | Python parity of `load-local-env.js`: fill-don't-override `.env` hydration; `require_keys()` fail-closed assertion; G4 names-only audit | no |
| `ticket_helpers.py` | `extract_issue_num()`, `extract_from_branch()`, `validate_ticket_linkage()` — shared by commit/baton gates | no |

**Wiki / knowledge hooks (2 scripts)**

| Script | Purpose | P | Notes |
|---|---|---|---|
| `wiki_router.py` | Task-adaptive wiki context snippets for SessionStart: resolves local `cwd/wiki` then global wiki candidates; injects relevant snippets | yes | imported by session_context.py |
| `wiki_wisdom.py` | Read governance wisdom pages from wiki/wisdom/; `post_merge_checklist()` used by stop_checks | no | shared library |

**Admin / merge / git helpers (4 scripts)**

| Script | Purpose | P |
|---|---|---|
| `admin_patterns.py` | `required_admin_ops(flags, repo_type)` — canonical list of admin completion ops; consumed by `tool_activity.py` stop-hook and `check_admin_ops` | no |
| `git_checks.py` | `detect_session_signals()`, `detect_uncommitted_changes()` — git state detection for stop-hook | no |
| `merged-branch-guard.py` | Block pushes to already-merged branches (#2878) | yes |
| `merge_claim_client.py` | HAMR merge-claim Python client; feature-flagged off | yes |

**Shell scripts (3 scripts)**

| Script | Hook event | Purpose | P |
|---|---|---|---|
| `validate-branch-name.sh` | pre-push (lefthook) | Deny push if branch name does not match `feat/fix/hotfix/chore/skill/<N>-slug` | yes |
| `pre-push-readability.sh` | pre-push (lefthook via `lint:readability:diff`) | Run diff-aware readability gate | yes |
| `detect-secrets-precommit.sh` | pre-commit (optional) | detect-secrets baseline scan | yes |

**Goal-tier / adaptive tier scripts (2 scripts — cross-listed with L13)**

| Script | Purpose | P |
|---|---|---|
| `goal_tier_resolver.py` | Resolve effective tier from `goal-tier-state.json` + role-minimum floor; stale GHS decays to baseline B | yes |
| `friction_event.py` | Python sibling of `scripts/global/friction-event.js`; emit schema-v3 `governance.friction` events to `~/.megingjord/incidents.jsonl` with G4 redaction | yes |

#### L4 — Ticket / GitHub Governance
*(unchanged from iter-1 — rows remain identical; no new rows needed)*

| Feature | SSoT file(s) | P | Per-runtime delta |
|---|---|---|---|
| Ticket-first + label taxonomy | `instructions/ticket-driven-work.instructions.md`, `github-governance.instructions.md` | yes | hook-enforced where supported; label-lint universal backstop |
| Label rules evaluator + manifest | `scripts/global/label-rules.js`, `label-manifest.json` | no | shared by label-lint + label-scan |
| Status cardinality / close-protection / optimistic-transition | `scripts/global/label-lint-*.js` | no | server-side Action |
| Deterministic PR linkage resolver | `scripts/global/linkage-resolver.js` | no | precedence Closes→deferred-final→Refs |
| Epic governance (phase gate, close-readiness, dormancy) | `instructions/epic-governance.instructions.md` + `epic-close-readiness-check.js`, `phase0-*.js`, `epic-dormancy-detector.js` | no | CI backstop fires regardless of orchestrator; `epic_close_guard.py` local |
| Conventional-commits enum + lane enum | `scripts/global/conventional-commits-enum.js`, `lane-enum.js` | no | SSoT for branch/PR/lane validators |
| Ruleset config-as-code | `scripts/global/baton-authority/ruleset-config.js`, `apply-ruleset.js` | no | repo-level ruleset (id 18234114 live) |
| GitHub ruleset / capability / ops skills | `skills/github-*` | yes | per-runtime command adapter coverage varies |

#### L5 — Validators (megalint + CI workflows)

*(counts updated to authoritative numbers)*

| Feature | SSoT file(s) | P | Per-runtime delta |
|---|---|---|---|
| Megalint orchestrator | `scripts/global/megalint/index.js` | yes | VALIDATORS map must be identical; deployed copilot/codex/claude; **not antigravity/cursor today (closed by §2.4 artifactClass)** |
| 49 megalint validators (handoff schemas, signer fidelity, doc-coverage, merge-evidence, flaw-emission, parity-validator, chain-integrity, edd-required, admin-merge-exception, batch-cancel-evidence, batch-evidence, closeout-schema, collaborator-handoff, consultant-closeout, cross-team-response-fidelity, doc-coverage, fleet-review-required, linkage-resolver, manager-handoff, phase0-promotion-gate, prompt-artifact-lint, prose-link-check, red-team-evidence-quality, registry-tuple-coverage, signer-fidelity, test-discoverability, tier-tag-lint, worktree-naming-advisory, etc.) | `scripts/global/megalint/*.js` | mixed | many CI-invoked outside `runAll()`; see dispatch-gap list |
| 95 CI workflows (baton-gates, closeout-lint, label-lint, test-evidence, edd-required, quality-gates, baton-authority-merge, baton-fsm-proof, orchestrator-governance-parity, parity-guard, phase0-promotion-gate, etc.) | `.github/workflows/*.yml` | mixed | server-side universal backstop; many advisory→blocking replay-eval-gated |
| Config schema validator | `scripts/global/validate-config-schemas.js` + `config/*.schema.json` | yes | validates `.claude/`/`.codex/` config authored by any team |
| Prompt-artifact / prose-link / docs-health linters | `scripts/global/megalint/prompt-artifact-lint.js`, `prose-link-check.js`, `docs-health-detector.js` | mixed | advisory; replay-eval-gated promotion |
| Validator dispatch gap (orphaned non-`runAll()` validators) | `scripts/global/megalint/{fleet-review-required,registry-tuple-coverage,sub-issue-preference,worktree-naming-advisory}.js` (genuinely orphaned) + 7 others CI-only or transitive (see §5.0/§5.1) | yes | any runtime invoking `runAll()` silently misses these; close via T3.3 dispatch contract |

#### L6 — Routing / Cost / HAMR

| Feature | SSoT file(s) | P | Per-runtime delta |
|---|---|---|---|
| Lane policy + provider adapters | `scripts/global/model-routing-policy.json`, `routing-provider-adapters.json` | yes | shared policy; **cursor absent from runtimeKinds** |
| Model routing engine + per-role lane prefs | `scripts/global/model-routing-engine.js` | yes | caller must pass `opts.role` |
| Semantic pre-classifier (zero-ML, Layer-0 router) | `hooks/scripts/semantic_router.py` | yes | ~80% routing accuracy, <1ms; Python-hook side; JS side is `scripts/global/task-router.js` |
| Cascade dispatch (fleet→free-cloud→paid) | `scripts/global/cascade-dispatch.js` + `free-cloud-dispatch.js` | yes | shared; key availability per-runtime |
| HAMR provider wrapper | `scripts/global/hamr-provider-wrapper.js` | yes | 4 config paths; **antigravity not covered (reachable via §2.4 artifactClass)** |
| HAMR activation + sync-verify | `scripts/global/hamr-activate.sh`, `hamr-sync-verify.js` | yes | **sync-verify TARGETS = copilot+codex only**; antigravity not a HAMR_TEAM value |
| Sticky-route / header-spillover | `scripts/global/sticky-route.js`, `header-spillover.js` | no | pure |
| Cache-stats emit/gate, telemetry, fallback emit | `scripts/global/cache-stats-emit.js`, `cache-hit-gate.js`, `model-routing-telemetry.js` | mixed | shared `~/.megingjord/` surfaces; routing-telemetry is per-checkout `logs/` |
| **HAMR Cloudflare Worker — entry + scheduled + routes** | `cloudflare/hamr/worker.ts`, `cloudflare/hamr/scheduled.ts`, `cloudflare/hamr/routes/*`, `cloudflare/hamr/wrangler.toml` | no | single shared deploy; per-team DPoP + `x-hamr-team` header. **The hamr Worker is EXACTLY `{worker.ts, scheduled.ts, routes/*}` + its own `wrangler.toml`** |
| **Separate top-level (non-hamr) Worker** | `cloudflare/worker.ts`, `cloudflare/durable-object.ts`, `cloudflare/state-tools.ts`, `cloudflare/wrangler.toml` | no | `durable-object.ts` + `state-tools.ts` live at `cloudflare/` ROOT and belong to a **distinct Worker**, not the hamr Worker. (Corrects iter-1's `cloudflare/hamr/durable-object.ts` / `cloudflare/hamr/state-tools.ts` — those paths DO NOT EXIST.) |
| Merge-claim / fleet-claim / mailbox / mcp-dispatch / governance-bundle | `cloudflare/hamr/routes/*` + clients | yes | **only Python clients for fleet/merge claim** (no JS binding) |
| HAMR bypass detector + fleet-direct block (JS + 2 Py twins) | `scripts/global/hamr-bypass-detector.js` + `hooks/scripts/hamr_bypass_detector.py` + `hooks/scripts/hamr_fleet_direct_block.py` | yes | three twins that must stay in detection parity: the JS detector (CI/lint side), the Python bypass detector (`hamr_bypass_detector.py`, detects `hamr-bypass-ok:` markers + raw provider calls in tool input), and the Python fleet-direct block (`hamr_fleet_direct_block.py`, denies raw `:11434` Ollama curl and redirects to dispatch scripts). **Cross-ref L3**: `hamr_bypass_detector.py` (verified present) is a 64-script-corpus member not individually named in the L3 enumeration; it is the Python detector twin of `hamr-bypass-detector.js`, distinct from the `hamr_fleet_direct_block.py` PreToolUse guard already listed in the `pretool_guard.py` sub-guard table. |
| Tool-policy proxy / utilization sensor / offload KPI / doctor / rotation | `scripts/global/hamr-tool-*.js`, `hamr-utilization-sensor.js`, `hamr-doctor.js` | mixed | role-scoped; doctor capPath claude-specific |
| Friction event JS twin | `scripts/global/friction-event.js`, `friction-recurrence.js` | yes | **must stay in parity with `hooks/scripts/friction_event.py`**; both emit schema-v3 `governance.friction` to `incidents.jsonl` |
| IDE proxy (11437) | `instructions/ide-proxy.instructions.md` | runtime-NA | Claude Code only (Epic #1020); promotionPath: intentional platform limitation; substitute: none structurally possible |

#### L7 — Knowledge: Wiki / Docs / Memory

| Feature | SSoT file(s) | P | Per-runtime delta |
|---|---|---|---|
| Three-wiki typology (A/B/C) | `instructions/wiki-knowledge.instructions.md`, `wiki/WIKI*.md` | yes | claude/copilot/antigravity read `~/.copilot/wiki/`; codex `~/.codex/devenv-ops/wiki/`; **cursor absent** |
| Wiki ingest / backfill / mirror / reconcile / auto-update pipeline | `scripts/wiki/*` | no | Megingjord/CI-only producers |
| Wiki frontmatter schema + signing | `scripts/wiki/validate-frontmatter.js`, `sign-frontmatter.js`, `config/wiki-frontmatter.schema.json` | no | single impl |
| Wiki drift gate / health detector / lint / anneal | `scripts/wiki/drift-detector.js`, `wiki-health-detector.js`, `lint.js`, `anneal.js` | no | advisory; replay-eval-gated |
| Retrieval router (BM25+RRF) vs deployed keyword search | `scripts/wiki/retrieval-router.js` vs `scripts/global/wiki-search.js` | yes | **search script deployed copilot/codex only; claude/antigravity null; cursor absent** |
| Wiki runtime parity check | `scripts/global/wiki-parity-check.js` | yes | WIKI_PATHS map; cursor missing |
| Wisdom/project A4 isolation | `wiki/wisdom/project/` | yes | **deploy.sh ships full tree incl. project/ — A4 leak (fixed §5.4/T1.5)** |
| Doc-coverage matrix + N/A enum + gate | `config/doc-coverage-matrix*.yml`, `doc-coverage-na-reasons.json`, `megalint/doc-coverage.js` | yes | all Collaborators must emit doc-coverage block |
| docs/howto corpus (77 runbooks) | `docs/howto/*` | no | not deployed to runtime paths |
| Changelog fragment system | `scripts/global/changelog-aggregate.js`, `changelog-fragment-validator.js` | no | repo-local |
| Operator memory model | `~/.claude/projects/.../memory/` | runtime-NA | **Claude Code only; no cross-orchestrator promotion path**; promotionPath: wiki/wisdom/project/ is the intended cross-orchestrator analogue (formal, not session-local) |

#### L8 — Deploy / Sync / Runtime Registries

| Feature | SSoT file(s) | P | Per-runtime delta |
|---|---|---|---|
| Multi-target deploy dispatcher | `scripts/deploy.sh` | yes | copilot most complete; claude missing skills/agents/wiki; antigravity/cursor narrowest; `deploy:apply` default = `both` (copilot+codex) only; **+`scripts` artifactClass added (§2.4) ships scripts/global to all five** |
| Codex deploy/sync adapter (managed-block merge) | `scripts/global/codex-runtime.js` | yes | Codex-unique managed-block pattern; skills→`~/.agents/skills/` |
| Multi-target reverse sync | `scripts/sync.sh` | yes | **no sync:antigravity / sync:cursor (added by scaffold)**; canonical-main guard #2355 |
| xteam MCP register + server | `scripts/global/xteam-mcp-register.js`, `scripts/xteam-mcp/*` (incl. `scripts/xteam-mcp/leader-election.js`) | yes | 5 JSON/TOML merge paths; **cursor absent from `scripts/xteam-mcp/leader-election.js` VALID_TEAMS** (leader-election lives under `scripts/xteam-mcp/`, NOT `scripts/global/`) |
| Atomic deploy + manifest + verify | `scripts/global/deploy-atomic.js`, `deploy-manifest.js`, `verify-deploy.js` | yes | 5 targets; **no manifest/verify npm variant for antigravity/cursor (added)**; not chained from deploy:apply |
| Runtime session registry | `scripts/global/runtime-session-registry.js`, `runtime_session_register.py` | yes | only claude-code wires SessionStart registration |
| Hook parity check (3-way diff) | `scripts/global/hook-parity-check.js` | yes | 8 TRACKED scripts; **claude-code absent from DEPLOY_TARGETS** (reads ~/.copilot) |
| Orchestrator governance parity checker | `scripts/global/orchestrator-governance-parity.js` + `inventory/orchestrator-governance-parity.json` | yes | **checks copilot/codex/claude only; antigravity/cursor documented-not-parsed** |
| State-store parity check | `scripts/global/state-store-parity-check.js` | yes | KNOWN_STATE_ROOTS map |
| Runtime side-effect guard | `scripts/global/runtime-side-effect-guard.js` | yes | **ALLOWLIST = vscode-extension/codex/claude-code only; copilot/antigravity/cursor denied (phantom vscode-extension entry — §5.3)** |
| Inventory + config registries | `inventory/orchestrator-governance-parity.json`, `inventory/team-model-signatures.json`, `inventory/harness-self-test-registry.json`, `inventory/governance-manifest.schema.json`, `config/runtime-compatibility-matrix.yml`, `config/governance-rules.yaml` | yes | the de-facto multi-file parity registry (target for AC-R1 consolidation). **`runtime-compatibility-matrix.yml` lives under `config/`, NOT `inventory/`** (reconciles §4 surface-10); `governance-rules.yaml` is also under `config/` |
| Cross-team perspective registry | `inventory/team-perspectives.json` | yes | per-team `lens` + `strengths` for `claude-code`, `codex`, `copilot`, `antigravity`; feeds cross-family review / multi-judge dispatch (which non-Anthropic family reviews a claude-code author). **`cursor` absent** from `teams{}` — under uniform-full-parity this is an `absent` gap to close (add a `cursor` perspective entry); it is also a §4 onboarding fan-out surface (a new runtime must register its lens or it is invisible to perspective-aware review routing) |
| Auxiliary `scripts/` subdirectory corpus | `scripts/fleet/` (per-fleet-host configs: `36gbwinresource/`, `windows-laptop/`), `scripts/hooks/` (git-side branch guards distinct from `hooks/scripts/`), `scripts/regression/` (`fleet-hamr-replay.js` — **replay-eval governance-test surface**), `scripts/tools/` (`sse-load-test.js`), `scripts/windows-laptop/` (`install-litellm-service.ps1`, `start-litellm.ps1` — IT/fleet provisioning) | no | Repo-local / IT-fleet / CI surfaces; not per-runtime adapter targets. The full `scripts/` corpus is **8 subdirectories** (`fleet`, `global`, `hooks`, `regression`, `tools`, `wiki`, `windows-laptop`, `xteam-mcp`); `global`+`wiki`+`xteam-mcp` are cataloged elsewhere (L5/L6/L8, L7, xteam MCP row). `scripts/regression/` is the replay-eval governance-test surface (canonical example `fleet-hamr-replay.js` replays HAMR fleet traffic), in-scope for the "promotion is replay-eval-gated, not calendar-gated" pattern recurring across §5. **Disambiguation**: `scripts/hooks/` (git-side `.sh` audit scripts) is distinct from `hooks/scripts/` (the 64-script runtime hook corpus in L3) — must not be conflated. |
| npm deploy/sync/verify script surface | `package.json` | yes | uneven coverage across runtimes |

#### L9 — Skills / Agents / Commands

*(counts updated to authoritative numbers: 42 canonical skills, 45 claude commands, 8 canonical `agents/*.agent.md` personas / 11 `.claude/agents/*.md` adapters)*

| Feature | SSoT file(s) | P | Per-runtime delta |
|---|---|---|---|
| Canonical skill → per-runtime adapter deploy | `skills/*/SKILL.md` → `.claude/commands/`, `.antigravity/commands/`, `.codex/commands/`, `~/.copilot/skills/` | yes | **Copilot 42/42; Claude 45 (3 claude-only no canonical); Antigravity 5/45; Cursor 0** |
| 42 canonical skills (role-*, github-*, repo-*, wiki, fleet, etc.) | `skills/*/SKILL.md` | yes | Claude adapters: some stubs with diverged argument-hints |
| 3 Claude-only commands (anneal-trigger-router, fleet-review, cross-team-consult-pickup) | `.claude/commands/*.md` | yes | **no canonical SKILL.md** — promotionPath: create canonical SKILL.md for each |
| 2 Antigravity-only commands (baton-comment-build, worktree-status) | `.antigravity/commands/*.md` | yes | no canonical SKILL.md — promotionPath: same |
| INSTALL-GLOBAL.md per-skill install metadata | `~/.copilot/skills/*/INSTALL-GLOBAL.md` | yes | **Copilot-only** (subset, criterion undocumented) |
| Agent roster — **8 canonical `*.agent.md` personas**: `architect`, `governance-auditor`, `implementer`, `planner`, `quick`, `release-reviewer`, `router`, `security-scanner`. **`red-team` and `IT` exist ONLY as `.claude/agents` adapters** (`it.md`, `red-team.md`) with no `*.agent.md` source; `router-policy.md` is a third adapter-only file. | `agents/*.agent.md` (8), `.claude/agents/*.md` (11), `.antigravity/agents/*.md` | yes | **Claude 11 adapters (8 canonical + 3 adapter-only: `it.md`, `red-team.md`, `router-policy.md`); Copilot 8 (canonical via rsync); Antigravity 3; Codex 0 (script-layer router only); cursor via Copilot rsync.** promotionPath: add `*.agent.md` canonical source for `it`/`red-team`/`router-policy` so the 3 adapter-only files are not orphaned |
| Pre-merge sub-agent orchestrator + fragments | `scripts/global/pre-merge-review-orchestrator.js`, `agents/pre-merge-review/*.md` | no | CI-hosted, scaffolded/inert |
| Prompt-artifact structural linter | `scripts/global/megalint/prompt-artifact-lint.js` | no | scans skills/agents/.claude commands; excludes these from doc-audit surfaces (per memory `doc_audit_excludes_prompt_artifacts`) |
| Programmatic task router (script layer) | `scripts/global/task-router.js`, `task-router-policy.json` | no | Codex substitute for router agent |
| Agent deploy pipeline | `scripts/deploy.sh`, `deploy-manifest.js` | yes | **Codex no agents/ deploy path** |

#### L10 — Observability / Dashboard

| Feature | SSoT file(s) | P | Per-runtime delta |
|---|---|---|---|
| Unified event schema v3 + OTel GenAI | `scripts/global/event-schema-v3.js`, `event-schema-otel-genai.js` | no | **not deployed to cursor/antigravity today (reachable via §2.4 artifactClass)** |
| Lifecycle event emitter + events.jsonl surface | `scripts/global/emit-event.js`, `dashboard/events.jsonl` | yes | cursor/antigravity have no write path until §2.4 ships scripts/global |
| incidents.jsonl / cache-stats.jsonl surfaces | `~/.megingjord/*.jsonl` | yes | shared cross-runtime; Python `open('a')` bypasses canonical enforcer |
| Log rotation / redaction | `scripts/global/log-rotation.js`, `log-redaction.js` | no | SURFACES omits events.jsonl (gap) |
| Goal-coverage API + panel | `dashboard/api/goal-coverage-handlers.js`, `dashboard/js/goal-coverage-panel.js` | no | server-side (Copilot context) |
| Goal-health score + panel | `scripts/global/goal-health-score.js`, `dashboard/js/goal-health.js` | no | two snapshot paths (anneal-sensor.json vs /tmp/governance-audit.json) |
| SSE pipeline + jsonl-tail + transport | `scripts/sse-handler.js`, `jsonl-tail.js`, `dashboard/js/transport*.js` | yes | HOST_ENV demo/vscode/local; no adapter for codex/claude CLI |
| Multi-agent sessions + VENDOR_ICONS | `dashboard/js/multi-agent-sessions.js` | yes | recognizes copilot/claude/codex/antigravity/cursor/cline; needs `window.__AGENT_VENDOR` |
| Dashboard HTTP server | `scripts/dashboard-server.js` | yes | Copilot context only; deployed `~/.copilot/dashboard/` only |
| ~15 dashboard panels | `dashboard/js/*.js` | no | browser-only, Copilot-deployed |

#### L11 — Resilience / Anneal / Coordination

| Feature | SSoT file(s) | P | Per-runtime delta |
|---|---|---|---|
| Three-tier self-anneal | `instructions/workflow-resilience.instructions.md` + `anneal-tier1-aggregator.js`, `anneal-tier2-autofile.js` | yes | incidents.jsonl shared; tier-2 needs GitHub |
| Active-session exclusive lock | `scripts/global/worktree-active-session-lock.js` | yes | shared `~/.megingjord/active-session.lock`; no auto-acquire hook |
| Cross-team lease registry + gate + heartbeat | `scripts/global/cross-team-lease-registry.js`, `cross-team-lease-gate.js`, `worktree-lease-heartbeat.js` | yes | **path discrepancy: `.dashboard/` vs `~/.megingjord/` (fixed §5.4/T1.5)** |
| Cross-runtime injection guard | `scripts/global/cross-runtime-injection-guard.js` + corpus | yes | not wired as blocking gate; knownTeams enrollment |
| HAMR mailbox client (Tier-2) + GitHub-native mailbox (Tier-1) | `scripts/global/mailbox-client.js`, `github-mailbox.js`, `mailbox-outbox.js` | no | substrate-selected by `MEGINGJORD_HAMR_ENABLED` |
| Merge-claim client | `hooks/scripts/merge_claim_client.py` | yes | Python only; feature-flagged off |
| Breaking-change recovery | `instructions/breaking-change-recovery.instructions.md` + skill | no | 6-phase, runtime-agnostic |
| Worktree governance / sandbox / tool-boundary | `instructions/sandbox-worktree-governance.instructions.md`, `worktree-tool-boundary.instructions.md` + `worktree-governance-audit.js` | yes | per-runtime launcher branches + tool API names |
| Resource-tier portability + tier-assert | `instructions/resource-tier-portability.instructions.md`, `tier-assert.js` | no | `MEGINGJORD_MINIMUM_TIER` future enforcement |
| Credential prompt guard | `instructions/credential-prompt-guard.instructions.md`, `scripts/global/credential-availability.js` | yes | instructional + helper |
| Friction event system (JS+Py twins) | `scripts/global/friction-event.js`, `friction-recurrence.js`, `hooks/scripts/friction_event.py` | yes | **JS and Py twins must stay in schema parity**; both emit `governance.friction` schema-v3 to `~/.megingjord/incidents.jsonl`; recurrence model feeds tier-2 autofile |

#### L12 — Goal Constitution & Decision Lens *(NEW)*

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| G1–G10 Harness Goal Constitution | `instructions/harness-goals.instructions.md` | yes | Loaded into every runtime system prompt that processes `instructions/`; G1-G10 priority order is the universal decision lens | — |
| Tier-graceful degradation pattern | `instructions/harness-goals.instructions.md` §Tier-graceful degradation | yes | Cross-cutting G5+G6 pattern binding all runtimes | cursor/antigravity: confirm instruction-load coverage |
| G10 EDD / 100-line cap / cyclomatic complexity floor | `instructions/harness-goals.instructions.md` (G10) + `edd-required.yml` + `lint.js` | yes | CI-enforced universal; local lefthook also runs line-cap | — |
| Goal-lens decision lint (G1>G2>…>G10 priority chain) | `instructions/global-standards.instructions.md` §Goal-lens decision lint | yes | Instructional binding for all governed decisions | — |
| Resource-tier vocabulary (T0–T5) | `instructions/resource-tier-portability.instructions.md` | yes | Operator-specific baseline; G5 cross-cuts all features | — |

**Parity note**: The Goal Constitution is a **provider-neutral-governance** surface (`instructions/provider-neutral-governance.instructions.md`). Every runtime that loads `instructions/` as a system prompt receives it. Runtimes that do NOT load `instructions/` (cursor via `.cursor/rules/` only; antigravity via User-Rules only) receive a truncated form — this is an existing documented gap that uniform-full-parity requires closing via deploy-path extension.

#### L13 — Adaptive Goal-Health / Actuator Closed-Loop *(NEW)*

This plane implements Epic #1113: a closed-loop system that measures overall governance health (GHS) and automatically adjusts baton stringency via 7 actuators (A1–A7).

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| Goal-Health Score (GHS) computation | `scripts/global/goal-health-score.js` | no | Pure computation over governance signals; shared snapshot | — |
| Actuator engine (7-actuator tier governance) | `scripts/global/actuator-engine.js` | no | Reads GHS → writes `~/.megingjord/goal-tier-state.json`; pure function `runActuators()` | — |
| Actuator transitions (hysteresis + cooldown) | `scripts/global/actuator-transitions.js` | no | `applyTransition()` shared by all 7 actuators | — |
| Actuator epic sync | `scripts/global/actuator-epic-sync.js` | no | Sync actuator state to Epic ticket comments for cross-team visibility | — |
| Goal-tier state file | `~/.megingjord/goal-tier-state.json` | yes | Written by actuator-engine; **shared across runtimes via shared `~/.megingjord/` path** | — |
| Goal-tier resolver (hook-side) | `hooks/scripts/goal_tier_resolver.py` | yes | Reads `goal-tier-state.json`; resolves effective tier for current session; stale GHS decays to B; role-minimum floor (Consultant floor B+) | wired via `goal_lens.py`; antigravity/cursor: confirm hook wiring |
| Goal-tier override | `scripts/global/goal-tier-override.js` | no | Manual override path for operator-supervised tier adjustments | — |
| Actuator behavior matrix (A1–A7) | `actuator-engine.js` (inline) | yes | A1: test coverage tier (B→B++++); A2: cross-family review required→advisory; A3: handoff block required; A4: consultant mandatory; A5: operator notification; A6: session reminder; A7: anneal auto-trigger | all runtimes see tier effects via shared state file |
| GHS dashboard panel | `dashboard/js/goal-health.js` | no | Copilot-only dashboard; no adapter for other runtimes | — |
| Anneal-sensor snapshot | `generated/anneal-sensor.json` | no | Snapshot written by GHS computation; consumed by dashboard and `/api/goal-coverage` | — |

**Parity note**: The actuator closed-loop is **cross-runtime by design** — `goal-tier-state.json` in the shared `~/.megingjord/` root is readable by all runtimes. The gap is in the **hook wiring**: `goal_tier_resolver.py` is called by `goal_lens.py` (UserPromptSubmit), which must be wired into every runtime's hook config. Antigravity and Cursor wiring is unconfirmed.

#### L14 — Local Pre-Push/Pre-Commit Suite (lefthook) *(NEW)*

The `lefthook.yml` at the repo root defines the **local** pre-push/pre-commit/post-merge enforcement layer — distinct from CI workflows (the universal backstop) and from the per-runtime hook config files (which govern AI agent tool calls).

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| lefthook pre-commit suite | `lefthook.yml` §pre-commit | yes | `docs-check-on-package-json` (runs `pre-commit-docs-check.js` when `package.json` changes) | human developers: activated by `npx lefthook install`; AI agents: wired via PostToolUse git-commit hooks |
| lefthook pre-push suite (15 commands) | `lefthook.yml` §pre-push | yes | Parallel: `branch-name-regex`, `lint-line-cap`, `lint-readability`, `lint-js`, `lint-md`, `lint-py`, `lint-sh`, `megalint`, `hydration-lint`, `closeout-preflight`, `closeout-presence-check`, `git-freshness`, `merged-branch-guard`, `cross-team-lease-gate`, `collaborator-self-check` (`scripts/global/collaborator-self-check.js` — the #2907 hard gate). (`docs-check-on-package-json` is **pre-commit**, not pre-push; `worktree-teardown-actuate` is **post-merge**.) | AI agents: wired via `worktree_push_gate.py` hook which validates these run before push |
| lefthook post-merge (squash-aware teardown) | `lefthook.yml` §post-merge | no | `worktree-teardown-actuate` — runs `worktree-teardown-actuate.js --apply` after `git pull`/merge to clean up merged worktrees | human developer only; AI agents use `npm run worktree:teardown` manually |
| Lefthook install path | `npm run lefthook:install` (or `npx lefthook install`) | yes | Must be re-run after repo clone and after `deploy:apply` for each AI agent runtime's local checkout | cursor/antigravity: unconfirmed whether lefthook is installed in their worktrees |

**Parity note**: lefthook is a **human-developer + AI-agent shared** local enforcement surface. Its 15 pre-push commands duplicate some CI gates locally (G7: catch failures before CI round-trip). For AI agents operating in worktrees, the `worktree_push_gate.py` hook enforces that the gate suite runs before push. The gap: cursor and antigravity worktrees may not have lefthook installed — this is a T2.3/T2.4 scaffold item.

#### L15 — Repo-Type Governance-Profile System *(NEW)*

The governance-profile system allows the harness to apply **repo-type-specific gate sets** rather than one-size-fits-all rules. It is the per-repo counterpart to the per-runtime hook config.

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| Governance profiles registry | `hooks/governance-profiles.json` | no | 4 named profiles: `web-app`, `vscode-extension`, `cli-library`, `governance-harness`; each declares commit/PR/release gates and per-layer lint sets | — |
| Repo type detector | `hooks/scripts/repo_detection.py` | yes | Detects repo type from file fingerprints (package.json scripts, manifest keys, directory structure); outputs profile name | all runtimes should call this; wiring unconfirmed for antigravity/cursor |
| Repo-standards router skill | `skills/repo-standards-router/SKILL.md` | yes | Operator-invoked: routes governance setup decisions to the correct per-profile gate set | Claude 45/Copilot 42 adapters; antigravity partial; cursor absent |
| Repo-scope guard | `hooks/scripts/repo_scope.py` + `hooks/repo-scope.json` | yes | Restrict hook enforcement to configured repo paths; runtime-ordered candidate list | all runtimes nominally covered |
| Profile-keyed lint sets | `hooks/governance-profiles.json` §lint | no | `agnostic` (line-limit, readability, secret-scan) + `language` (eslint/stylelint/ruff) + `project` (lighthouse/vsce/api-extractor) | — |
| Profile-keyed PR/release gates | `hooks/governance-profiles.json` §gates | no | `web-app`: visual_qa+lighthouse; `vscode-extension`: extension_test+version_bump+vsce_publish; `cli-library`: unit_tests+api_compat+semver_check | — |

> **Correctness note (cross-ref §5.3)**: the `vscode-extension` governance profile in `hooks/governance-profiles.json` and the matching `runtime-side-effect-guard.js` ALLOWLIST entry are **phantom** — the `vscode-extension/` directory does not exist in the repo. Disposition (remove vs restore) routes to the free cross-model panel; tracked in T3.6.

#### L16 — EDD Gate Subsystem *(NEW)*

GOV-009 mandates that every `lane:code-change` implementation ticket carry an EDD artifact before the PR can merge. This is a standalone governance gate with its own enforcement surface.

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| EDD contract definition (GOV-009) | `instructions/harness-goals.instructions.md` G10, `instructions/global-standards.instructions.md` | yes | All runtimes must produce an `## EDD` comment block on `lane:code-change` tickets | — |
| EDD validator (megalint) | `scripts/global/megalint/edd-required.js` | no | CI-invoked; validates: `scope:`, `acceptance:`, `risk:`, `implementation-plan:` fields present; exempt lanes: trivial, config-only, docs-research, no-code-remediation | — |
| EDD CI gate | `.github/workflows/edd-required.yml` | no | Universal CI backstop; reads PR body for `Refs #N`, fetches linked issue comments, calls `edd-required.js`; fails PR if EDD absent on non-exempt lane | — |
| EDD comment contract (`## EDD` marker) | Issue comment convention | yes | Operator (any runtime) must post the `## EDD` comment on the linked issue before pushing; `edd-required.js` re-runs after posting resolves the gate | — |
| EDD local pre-push check | `lefthook.yml` §megalint (via `node scripts/global/megalint/index.js`) | yes | Local megalint run during pre-push catches EDD absence before CI; depends on `CLOSEOUT_CHECK_BLOCK` / `COLLABORATOR_SELF_CHECK_INPUT` env vars | — |

**Parity note**: EDD is **instructional + CI-enforced** — any runtime that pushes to a branch covered by `edd-required.yml` is subject to it. The gap is local pre-notification: `edd-required.js` membership in the `runAll()` `VALIDATORS` map must be confirmed (it is in the 49-validator set) — this is a T3.3 dispatch-contract item.

#### L17 — Authorization-Profile Subsystem *(NEW)*

The authorization-profile subsystem provides fine-grained, config-driven capability control over which operations each operator profile can invoke. It is distinct from the role-tool-allowlist (baton-role-scoped) — it is identity/environment-scoped.

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| Authorization profile schema | `config/authorization-profiles.json` | no | 3 named profiles: `owner`, `guarded`, `restricted`; 5 required capability fields: `install`, `upgrade`, `privileged`, `execute_local`, `execute_remote` | — |
| Authorization profile resolver (JS) | `scripts/global/authorization-profile.js` | no | Resolution order: CLI flag > env var > config file > default; `parseActiveProfile()` validates schema | — |
| Authorization profile context (JS) | `scripts/global/authorization-profile-context.js` | no | Builds operator context string injected into session context | — |
| Authorization profile enforcer (Python hook) | `hooks/scripts/auth_profile_enforcer.py` | yes | PreToolUse: cap tool calls to active profile's capability set; config-driven; fail-open | wired pretool_guard; antigravity/cursor wiring unconfirmed |
| Authorization profile enforcer (JS) | `scripts/global/auth-profile-enforcer.js` | yes | JS parity of Python enforcer; consumed by megalint / CI context | must stay in behavioral parity with Python hook |
| Authorization-profile instruction | `instructions/authorization-profile-context.instructions.md` | yes | Loaded into system prompt; governs operator-level capability declaration | all runtimes that load `instructions/` |
| Conformance spec | `scripts/global/authorization-profile-conformance.spec.js` | no | Contract test: JS resolver + enforcer must agree on all 3 profiles × 5 capabilities | — |

#### L18 — Operator-Ownership / Client-Arbitration Enforcement Plane *(NEW — iter-3)*

This plane is the **machine-enforcement layer behind the deliverable's own "the approver is never the client" rule** (the §2.1 `approver` enum that excludes `client`, the §2.3 binding adjudication, and the operator-identity contract). It is the executable backing for client-directed Epics **#3391 / #3392** (add an autonomy goal to the Constitution; remediate all client-prompt surfaces + add a cross-model adjudication guardrail). It belongs as a first-class catalog layer because it converts a prose invariant into a tested, config-driven gate.

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| Operator-ownership rule registry | `inventory/operator-ownership-rules.json` | no | `scopedFiles` (`instructions/operator-identity-context.instructions.md`) + 3 assertion sets: `operator-owned-execution`, `user-client-design-uat`, `no-manual-delegation`, each a literal-pattern list | — |
| Operator-ownership rule loader | `scripts/global/operator-ownership-rules.js` | no | Loads + exposes the JSON assertion registry; shared pure module | — |
| Operator-ownership evaluator | `scripts/global/operator-ownership-eval.js` | no | Evaluates a text surface against the assertion patterns; deterministic; consumed by lint/CI | — |
| Delegation-phrase lint | `scripts/global/delegation-phrase-lint.js` | yes | Flags client-arbitration leakage ("you will need to…", "please manually…", "the user must…") in operator output / artifacts; the JS twin of the `client_arbitration_guard.py` Stop-hook (L3) | antigravity/cursor: confirm the JS lint is wired into their deployed `scripts/global` corpus (reachable via the §2.4 `scripts` artifactClass) |

**Parity note**: This plane has two enforcement faces that must stay in parity — the runtime Stop-hook `hooks/scripts/client_arbitration_guard.py` (already cataloged in L3) and the static/CI-side `delegation-phrase-lint.js` + `operator-ownership-eval.js`. Both encode the same "client = design + UAT only; never an approver/gate-keeper" invariant from `governance/README.md` §Client-Arbitration Prohibition (#2578). Under uniform-full-parity the JS evaluators must ship to all five runtimes via the §2.4 `scripts` artifactClass so the contract is enforceable wherever the operator runs, not only on Claude Code's hook plane.

#### L19 — Policy-as-Code Pilot + Rubric/Review SSoT Plane *(NEW — iter-3)*

This plane groups two related machine-readable governance SSoTs that iter-2 left uncataloged: the **Cedar policy-as-code pilot** (an experimental declarative-authorization substrate) and the **G1–G10 rubric SSoT + deterministic scorer** that backs `instructions/review-score-contract.instructions.md` (the canonical Consultant/cross-family scoring contract).

##### Cedar policy-as-code pilot

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| Cedar policy corpus | `inventory/cedar-policies/*.cedar` (present: `signer-alias-canonical.cedar`) | no | Declarative Cedar authorization policies; pilot scope | — |
| Cedar pilot evaluator | `scripts/global/cedar-pilot.js` | no | Loads + evaluates the `.cedar` corpus; experimental policy-as-code spike | — |
| MS-toolkit pilot (comparative) | `scripts/global/ms-toolkit-pilot.js` | no | Sibling policy-engine spike evaluated alongside Cedar | — |

**Note**: The Cedar/MS-toolkit pilots are exploratory policy-engine spikes (`parity: no` — shared/CI-only, not a per-runtime adapter surface). They are cataloged so the AC-R1 keystone records them as candidate future substrates for the hand-enumerated registry consolidation, not as already-load-bearing parity features.

##### Rubric G1–G10 SSoT + multi-judge scorer

| Feature | SSoT file(s) | P | Per-runtime delta | promotionPath for NA/partial |
|---|---|---|---|---|
| G1–G10 rubric SSoT (current) | `inventory/rubric-g1-g10-v3.json` | no | `version: g1-g10-v3`; `score_formula: (boxes_checked / boxes_total) * 10`; per-goal box list with deterministic `evidence_command` DSL (`contains\|regex\|not_regex:<trail\|diff\|closeout>:…`) | — |
| G1–G9 rubric SSoT (legacy, valid in transition) | `inventory/rubric-g1-g9-v2.json` | no | predecessor schema; scorer accepts both v2 and v3 until replay-eval promotion (#1967) | — |
| Deterministic rubric scorer | `scripts/global/rubric-score.js` | yes | Reads the rubric SSoT; emits 0–10 per goal + 0–10 mean; the verifiable-scoring path of `instructions/review-score-contract.instructions.md`; consumed by Consultant closeout + cross-family review | antigravity/cursor: ship via §2.4 `scripts` artifactClass so the scorer runs on those runtimes' Consultant/review paths |
| Multi-judge prompt templates | `scripts/global/multi-judge-prompts.js` | no | Prompt templates for the cross-family / multi-judge LLM scoring lane that layers on top of the deterministic scorer | — |

**Parity note**: `instructions/review-score-contract.instructions.md` (already listed in the §"Instruction set as a parity surface" table) is the **prose contract**; `inventory/rubric-g1-g10-v3.json` is its **machine-readable SSoT**, and `rubric-score.js` is its **deterministic executor**. The instruction, the rubric JSON, and the scorer form one parity triple — a runtime that loads the instruction but lacks the scorer (cursor/antigravity today, since `scripts/global` is not yet deployed there) can read the contract but cannot mechanically produce a verifiable G1–G10 score. Uniform-full-parity closes this via the §2.4 `scripts` artifactClass.

---

### Visual-QA plane *(previously uncatalogued — integrated into L3 + L5 + L7/L12 + L15)*

| Feature | SSoT file(s) | Layer | P | Per-runtime delta |
|---|---|---|---|---|
| Visual-QA evidence block contract | `instructions/visual-qa-governance.instructions.md` | L12/L7 | yes | All runtimes on web-surface changes; on-demand instruction load |
| Visual-QA state recorder | `hooks/scripts/visual_qa_record.py` | L3 | yes | Records `admin_ops.visual_qa = True` + evidence list in governance state; depends on state_store |
| Visual-QA governance profile gate | `hooks/governance-profiles.json` §web-app PR gates | L15 | yes | `web-app` profile requires `visual_qa: true` in PR gates |
| Visual-QA megalint validator (if present) | `scripts/global/megalint/visual-qa-*.js` (confirm existence) | L5 | no | CI-side check for `VISUAL_QA_EVIDENCE` block in COLLABORATOR_HANDOFF |

### Instruction set as a parity surface (all 44 `instructions/*.md` files)

The 44 instruction files are **themselves a parity surface**: every file that declares a binding rule must be loaded into at least one runtime system prompt. The `always-resident` vs `on-demand` split below is **not editorial — it is computed by `scripts/global/instructions-split-classifier.js`** (the classifier named in `CLAUDE.md` §"On-demand instructions"), which fails open: any binding signal or core-identity marker forces `always-resident`, so only situational, non-binding files (e.g. `visual-qa-governance`, `playwright-mcp-low-resource`, `owasp-agentic-mapping`, `repo-health-onboarding`) classify as `on-demand`. Files marked `always-resident` are loaded on every turn; `on-demand` are loaded situationally (via the read-router / `Read`). "Runtimes that load it" abbreviated below as **(all)** = claude/copilot/codex always-resident; antigravity via User-Rules; cursor via `.cursor/rules/megingjord.mdc`.

| File | Load mode | Binding scope | Loaded by |
|---|---|---|---|
| `role-baton-routing.instructions.md` | always-resident | baton workflow, role taxonomy, gate conditions | (all) |
| `test-methodology-matrix.instructions.md` | always-resident | test strategy selection | (all) |
| `ticket-driven-work.instructions.md` | always-resident | ticket-first governance | (all) |
| `operator-identity-context.instructions.md` | always-resident | operator=AI agent contract | (all) |
| `team-model-signing.instructions.md` | always-resident | signing fields, alias derivation | (all) |
| `global-standards.instructions.md` | always-resident | engineering standards, deferred-finalize, goal-lens lint | (all) |
| `global-task-router.instructions.md` | always-resident | lane policy, fleet mandate | (all) |
| `github-governance.instructions.md` | always-resident | issue/PR/commit conventions | (all) |
| `epic-governance.instructions.md` | always-resident | Epic rules, phase gates | (all) |
| `feature-completion-governance.instructions.md` | always-resident | completion semantics, admin completion contract | (all) |
| `workflow-resilience.instructions.md` | always-resident | self-anneal triggers, three-tier model | (all) |
| `release-docs-hygiene.instructions.md` | always-resident | post-merge/post-deploy checklist | (all) |
| `wiki-knowledge.instructions.md` | always-resident | wiki access model, retrieval routing | (all) |
| `hamr-routing.instructions.md` | always-resident | HAMR provider contract, cost levers | (all) |
| `observability.instructions.md` | always-resident | logging surfaces, schema standard, PII redaction | (all) |
| `cross-team-artifact-write.instructions.md` | always-resident | cross-runtime write gate, TEAM_QUESTION/TEAM_RESPONSE | (all) |
| `cross-team-communication-tiers.instructions.md` | always-resident | Tier-1/2/3 substrate selection | (all) |
| `resource-tier-portability.instructions.md` | always-resident | T0–T5 taxonomy, G5 binding rule | (all) |
| `credential-prompt-guard.instructions.md` | always-resident | forbidden credential-prompt behavior | (all) |
| `worktree-tool-boundary.instructions.md` | always-resident | file-editing tool boundary (workspace path check) | (all) |
| **`harness-goals.instructions.md`** *(NEW — was uncatalogued)* | always-resident | G1–G10 goal constitution, tier-graceful degradation, G10 EDD floor | (all) |
| **`provider-neutral-governance.instructions.md`** *(NEW — was uncatalogued)* | always-resident | provider-neutral contract; binds all runtimes regardless of LLM backend | (all) |
| **`programmatic-governance.instructions.md`** *(NEW — was uncatalogued)* | always-resident | programmatic-first authoring standard; operator owns docs via scripts | (all) |
| **`authorization-profile-context.instructions.md`** *(NEW — L17)* | always-resident | authorization profile capability declaration | (all) |
| `breaking-change-recovery.instructions.md` | always-resident | 6-phase recovery protocol | (all) |
| `sandbox-worktree-governance.instructions.md` | always-resident | worktree launcher, tool API names | (all) |
| `governance-controls.instructions.md` | always-resident | controls inventory | (all) |
| `recurring-patterns.json` | always-resident (data) | pattern registry for anneal/recurrence | (all) |
| `canonical-governance-anti-duplication.instructions.md` | always-resident | prevent duplicating hook logic in instructions | (all) |
| `collaborator-rebase-discipline.instructions.md` | always-resident | rebase/squash discipline for Collaborator role | (all) |
| `cross-family-review.instructions.md` | always-resident | cross-family review protocol | (all) |
| `cross-team-baton-assumption.instructions.md` | always-resident | cross-team baton handoff assumptions | (all) |
| `cross-team-consultant.instructions.md` | always-resident | cross-team consultant engagement | (all) |
| `cross-team-rd-synthesis.instructions.md` | always-resident | cross-team R&D synthesis protocol | (all) |
| `hook-behavior-overrides.instructions.md` | always-resident | hook behavior override contract | (all) |
| `readability-commenting-governance.instructions.md` | always-resident | readability gate, commenting standards | (all) |
| `review-independence-promotion.instructions.md` | always-resident | review independence escalation | (all) |
| `review-score-contract.instructions.md` | always-resident | review rubric G1-9 scoring contract | (all) |
| `role-consultant-critique.instructions.md` | always-resident | Consultant critique protocol | (all) |
| `team-model-in-workflows.instructions.md` | always-resident | Team&Model identity in GitHub Actions | (all) |
| `ide-proxy.instructions.md` | always-resident (Claude-only) | IDE proxy port 11437 | claude-code only; runtime-NA for others |
| `visual-qa-governance.instructions.md` | **on-demand** | Visual QA evidence block requirements | loaded when modifying HTML/CSS/JS |
| `playwright-mcp-low-resource.instructions.md` | **on-demand** | Playwright / browser automation | loaded for Playwright work |
| `owasp-agentic-mapping.instructions.md` | **on-demand** | OWASP agentic threat mapping | loaded for security-mapping work |
| `repo-health-onboarding.instructions.md` | **on-demand** | New-repo onboarding / health audits | loaded for repo onboarding |

**Parity gap**: Antigravity and Cursor receive a subset of these instructions (Antigravity: User-Rules system prompt; Cursor: `.cursor/rules/megingjord.mdc`). The 20+ always-resident files not in those surfaces are a governance-contract gap — these runtimes operate without binding rules they should have. Uniform-full-parity requires extending the deploy path to ship the full instruction set to antigravity and cursor (the `instructions` `artifactClass` per the §2.3 / §4 adjudication). The on-demand files are not a gap since they are loaded situationally.

---

### Proposed machine-readable catalog schema (AC-R1 keystone) — revised

The schema is extended with new fields relative to iter-1. (Note: the `perRuntime` cell shape and its **required `substituteTest`** for `structural-NA`/`waived` cells is fully normative in §2.1 — that is the authoritative cell schema; the shape below shows the surrounding feature object plus the iter-2 additions.)

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "catalogVersion": "<sha256(features+layers)[:16]>",
  "layers": [
    "L1-identity-signing", "L2-baton-contract-artifacts", "L3-hook-gate-enforcement",
    "L4-ticket-github-governance", "L5-validators-ci-workflows", "L6-routing-cost-hamr",
    "L7-knowledge-wiki-docs-memory", "L8-deploy-sync-registries", "L9-skills-agents-commands",
    "L10-observability-dashboard", "L11-resilience-anneal-coordination",
    "L12-goal-constitution-decision-lens", "L13-adaptive-goal-health-actuator",
    "L14-lefthook-local-pre-push-commit", "L15-repo-type-governance-profile",
    "L16-edd-gate-subsystem", "L17-authorization-profile-subsystem",
    "L18-operator-ownership-client-arbitration", "L19-policy-rubric-review-ssot"
  ],
  "features": [
    {
      "id": "detect-runtime",
      "name": "Runtime Detector",
      "layer": "L1-identity-signing",
      "purpose": "Identify which orchestrator runtime is active from environment markers; used by all identity and routing logic",
      "ssotFiles": ["scripts/global/detect-runtime.js"],
      "parity": "yes|no|runtime-NA",
      "deltaKind": "env-marker|state-root|config-path|adapter-surface|alias|pure|server-side|none",
      "perRuntime": {                          // REQUIRED when parity == "yes"; cell shape per §2.1 $defs/parityCell
        "claude-code": { "$ref": "#/$defs/parityCell" },
        "copilot":     { "$ref": "#/$defs/parityCell" },
        "codex":       { "$ref": "#/$defs/parityCell" },
        "cursor":      { "$ref": "#/$defs/parityCell" },
        "antigravity": { "$ref": "#/$defs/parityCell" }
      },
      "enforcement": {
        "ciWorkflow": "orchestrator-governance-parity.yml | null",
        "test": "tests/<spec>.spec.js | null",
        "validator": "scripts/global/megalint/<v>.js | null"
      },
      "onboardingArtifact": {
        "kind": "registry-entry|hook-wiring|deploy-target|adapter-dir|config-file|instruction-load|none",
        "template": "templates/<feature>.tmpl | null",
        "targetPath": "<path-with-{runtime}-placeholder> | null"
      },
      "promotionPath": {                       // per-runtime concrete step to reach `full` for every non-full cell
        "cursor": "<e.g. T2.3: run scaffold, wires hook config>",
        "antigravity": "<concrete step>"
      },
      "subGuards": [],                         // for dispatcher scripts (pretool_guard.py): sub-guard module names
      "sources": ["instructions", "scripts-global-core", "deploy-registry"]
    }
  ]
}
```

**New fields vs iter-1 schema**:

- `perRuntime[runtime].advisoryBackstop` — for cells that are `partial` or `advisory-backstop-exists` (the antigravity characterization fix), names the CI workflow or instruction that provides equivalent coverage. Distinguishes `absent` (no backstop) from `advisory-backstop-exists` (backstop exists but is not a mechanical hook gate). Under uniform-full-parity, `advisory-backstop-exists` is NOT `full` — resolution is to make the hook gate mechanically wired, not to tier-down.
- `promotionPath` — per-runtime concrete step to reach `full` for every cell not already `full`. Mechanically derives the T1–T3 decomposition children.
- `subGuards` — for `pretool_guard.py` and similar dispatchers: list of sub-guard modules this feature delegates to, so the parity matrix verifies each sub-guard is wired per runtime, not just the top-level dispatcher.

**Design rationale (goal-lens)**: **G1** the catalog is the SSoT; every parity claim cites `evidence`; `advisory-backstop-exists` is explicit, not silent. **G10** content-addressed `catalogVersion` (same pattern as `team-model-signatures.json#registryVersion`) makes drift detectable. **G5** `parity: "runtime-NA"` + `promotionPath: null` signals genuine structural impossibility; `advisory-backstop-exists` + non-null `promotionPath` signals an implementable gap. **G8** `advisoryBackstop` makes the CI backstop visible to the parity matrix so it can probe the backstop independently.

---

### Catalog totals (revised)

- **19 layers** (11 original + 8 new governance planes; L12–L17 added in iter-2, **L18–L19 added in iter-3**).
- **~183 distinct features** after de-duplication (vs ~170 in iter-2 / ~150 in iter-1; iter-2 additions: the 64-file hook corpus (61 `.py` + 3 `.sh`) enumerated by function group, adding ~15 previously unnamed; visual-qa plane; semantic_router; friction-event twins; actuator/GHS system; lefthook suite; repo-profile system; EDD subsystem; authorization-profile subsystem; Cloudflare Worker surface files; 44 instructions as a parity surface. **iter-3 additions (~13): the 4 L18 operator-ownership-plane features; the 3 L19 Cedar/MS-toolkit pilot features; the 4 L19 rubric/review-SSoT features; the third `hamr_bypass_detector.py` twin; `inventory/team-perspectives.json`; the auxiliary `scripts/` subdirectory corpus row; plus the `governance/README.md` keystone-SSoT cross-reference.**).
- **~105 features flagged `needs_per_orchestrator_parity = yes`** (vs ~95 in iter-1).
- **~40 features flagged `no`** (pure/shared/CI-only).
- **~25 features `runtime-NA`** with explicit `promotionPath` or structural-impossibility justification.

---

## 2. PARITY MODEL, GAP MATRIX, AND BINDING ADJUDICATION (AC-R2 / AC-R3)

> This section supersedes iter-1 §2 (gap matrix) and iter-1 §3 (uniform-vs-tiered tension). The AC-R3 question is **RESOLVED** here (§2.3) by client design authority and applied consistently across §2.1 (cell schema), §2.2 (matrix), §2.4 (artifactClass), and every downstream section.

### 2.1 Parity-cell schema — REQUIRED-substitute fix (the authoritative cell shape)

> **Consistency fix (binding):** iter-1 allowed `status: "structural-NA" | "waived"` as a bare value and listed `note`/`evidence` as merely recommended. That was the §1-vs-§5 inconsistency: §5 asserts "a cell declared `waived`/`runtime-NA` must have an approver + substitute, and the substitute must itself probe `full`," but the §1 schema did not make `substituteTest` required. The schema below makes the §5 rule structurally unrepresentable to violate — a `structural-NA`/`waived` cell that omits `substituteTest`, `approver`, or whose substitute does not itself resolve to a `full` cell is **schema-invalid** (fail-closed), not merely advisory. **`substituteTest` is required everywhere a cell is `structural-NA` or `waived`.**

```jsonc
"perRuntime": {                              // REQUIRED when parity == "yes"
  "claude-code": { "$ref": "#/$defs/parityCell" },
  "copilot":     { "$ref": "#/$defs/parityCell" },
  "codex":       { "$ref": "#/$defs/parityCell" },
  "cursor":      { "$ref": "#/$defs/parityCell" },
  "antigravity": { "$ref": "#/$defs/parityCell" }
},
```

```jsonc
"$defs": {
  "parityCell": {
    "type": "object",
    "required": ["status", "evidence"],
    "properties": {
      "status":   { "enum": ["full", "partial", "absent", "structural-NA", "waived"] },
      "evidence": { "type": "string", "minLength": 1 },   // path|ref|registry-membership probe; required for EVERY cell
      "note":     { "type": "string" },
      "advisoryBackstop": { "type": "string" }            // names the CI workflow / instruction backing a partial cell
    },
    "allOf": [
      {
        // structural-NA and waived are NOT a bare escape value: each REQUIRES a tested substitute + approver.
        "if":   { "properties": { "status": { "enum": ["structural-NA", "waived"] } } },
        "then": {
          "required": ["substituteTest", "approver", "naReason"],
          "properties": {
            "naReason":  { "type": "string", "minLength": 1 },
            "approver":  { "enum": ["cross-model-panel", "manager+admin"] },  // never "client" (operator-identity contract)
            "substituteTest": {
              "type": "object",
              "required": ["feature", "probe", "mustProbeFull"],
              "properties": {
                "feature":       { "type": "string" },     // the catalog feature id that DELIVERS the equivalent guarantee
                "probe":         { "type": "string" },      // validator|test|deployed-file|registry-membership check
                "mustProbeFull": { "const": true }          // the substitute itself MUST resolve to a `full` cell
              }
            }
          }
        }
      }
    ]
  }
}
```

Design rationale (goal-lens): **G1** — every parity claim, including every NA, must cite `evidence`, and every NA must cite a `substituteTest` whose own probe resolves `full`. There is no bare "NA dodges parity" value. **G10** — content-addressed `catalogVersion` makes drift detectable. **G5** — `structural-NA` remains first-class so genuinely impossible surfaces are explicit, but it is now a *governed* value (tested-substitute + cross-model/manager+admin approver). **The client is never an `approver` enum value** — NA approval routes to the free cross-model panel or manager+admin per the operator-identity contract.

### 2.3 UNIFORM FULL PARITY — BINDING ADJUDICATION (RESOLVED, AC-R3)

> **Status: RESOLVED by client design authority (G1). This section no longer poses a question to a panel.** iter-1 §3 deferred the uniform-vs-tiered decision to the cross-model panel; the panel leaned *tiered*. That lean is **overridden by client directive**. The decision below is binding for all of Epic #3411 and MUST NOT be re-litigated by Phase-1 children, the synthesizer, or any reviewer.

#### The decision

**Epic #3411 targets UNIFORM FULL PARITY.** Every catalog feature flagged `parity: "yes"` MUST reach `full` on every one of the five runtimes (`claude-code`, `copilot`, `codex`, `cursor`, `antigravity`).

The corollary that distinguishes this from the rejected tiered model:

- **Where a surface is currently structurally *unreachable* for a runtime, the resolution is to MAKE IT REACHABLE — never to tier the runtime down.** The canonical example is the `scripts/global` JS gate corpus (megalint validators, `event-schema-v3.js`, `log-redaction.js`, `emit-event.js`, `hamr-provider-wrapper.js`): `deploy.sh` today `exit 0`s out of the `cursor` and `antigravity` branches before ever reaching the `deploy_files "$ROOT/scripts/global"` block, so those two runtimes never receive the corpus. The fix is **not** to declare those features `structural-NA`; the fix is to extend `deploy.sh`/the scaffold with a `scripts` **artifactClass** that ships the corpus to them (§2.4), turning every one of those cells from `absent` into a reachable `full`.

- **A documented tested-substitute exception (`structural-NA`) is permitted ONLY where the surface is genuinely structurally *impossible* for that runtime** — a platform-capability the runtime's host does not expose, not merely a surface the harness hasn't shipped yet. The bar is "impossible," not "inconvenient" or "not-yet-deployed."

#### What "structural-NA" now means (narrowed)

A cell may be `structural-NA` ONLY if **all** of:

1. The capability is **physically absent from the runtime's host platform** (e.g. Cursor/Antigravity expose no `PreCompact` lifecycle event — there is no event to wire a hook to). "We haven't deployed it" is NOT structural impossibility; that is an `absent` cell that MUST be driven to `full`.
2. A `substituteTest` is declared per the §2.1 schema, naming the catalog feature that delivers the equivalent governance guarantee, **and that substitute feature's own cell probes `full`** for the same runtime.
3. An `approver` (`cross-model-panel` or `manager+admin`) is recorded. The client is never the approver.

If any of (1)-(3) fails, the cell is **not** eligible for `structural-NA` and is treated as `absent` → a blocking gap under §5.

#### Worked re-classification of the prior draft's contested cells

| iter-1 §3 claim | Resolution under UNIFORM FULL PARITY |
|---|---|
| "Claude Code intentionally has no Python hook plane; forcing state_store would be parity-for-parity" | **Reachable, not NA.** The *guarantee* (state-backed PreToolUse gates) must reach `full` on claude-code. If the Python plane is the wrong substrate for claude-code, the substitute (settings.json-hook + CI baton-authority-merge gate) must be declared as a `substituteTest` whose own cell probes `full`. Not a bare NA. |
| "Codex has no `agents/` directory; script-router substitutes" | **Reachable, not NA.** Codex must reach `full` on agent-persona coverage either by shipping an agents adapter dir or via a declared `substituteTest` (`task-router.js` script-layer router) that itself probes `full`. The current `absent` is a gap to close. |
| "Cursor uses rules+hooks only, no skill surface" | **Reachable, not NA.** Cursor's zero skill/command surface (#3086) is the largest `absent` cluster. The scaffold ships skills to `~/.cursor/commands/`. Drive to `full`. |
| "PreCompact is Anthropic-runtime-native" | **The only genuine `structural-NA` candidate** — Cursor/Antigravity have no PreCompact event. Eligible *iff* a periodic-anchor substitute is declared and that substitute probes `full`. |
| "Operator memory is Claude Code-native" | **Reachable, not NA.** The cross-orchestrator analogue (`wiki/wisdom/project/` operator-feedback promotion path) must reach `full` on the other four runtimes, or operator-memory carries a `substituteTest` pointing at that promotion-path feature once it probes `full`. A bare claude-only NA is rejected. |
| "Model family per quick-tier agent (GPT-5-mini vs haiku)" | **Not a parity feature.** Lane/model-family selection is governed by `model-routing-policy.json` per-runtime adapters; the *parity invariant* is "the quick lane resolves to an adequate model," which is `full` everywhere. The specific family is an adapter detail, not a parity cell. |

#### Parity score is FLAT, full-floor

Because the model is uniform-full-parity, the §5 guardrail score is **flat** (no per-layer weighting): every `parity:"yes"` cell counts equally and the required floor is `full` for all of them. `structural-NA`/`waived` cells count as satisfied ONLY when their `substituteTest` resolves `full` (so they cannot inflate or deflate the score relative to a real `full`). There is no "governance-critical layers weighted higher" carve-out — the panel's per-layer-weighting sub-question is moot under the binding adjudication.

### 2.4 Making `scripts/global` reachable for cursor + antigravity (`scripts` artifactClass — AC-R3 resolution)

#### Root cause (verified)

`scripts/deploy.sh` ships `scripts/global` only on the copilot path (`deploy_files "$ROOT/scripts/global" "$COPILOT/scripts"`) and, for codex, via `scripts/global/codex-runtime.js` (`tree(scripts/global → ~/.codex/devenv-ops/scripts)`). The `cursor` and `antigravity` branches `rsync` only `.cursor/`/`.antigravity/` + `hooks/` + `agents/` and then `exit 0`, so the corpus never lands. Consequently `event-schema-v3.js`, `log-redaction.js`, `emit-event.js`, `hamr-provider-wrapper.js`, and all 49 `scripts/global/megalint/*.js` validators are **absent on cursor and antigravity today** — the structural unreachability the binding adjudication targets.

#### The fix: a declarative `scripts` artifactClass

Per AC-R3 (make-it-reachable, not tier-down), the runtime descriptor (`inventory/runtimes/<runtime>.json`, §4) gains `scripts` as a first-class member of `deploy.artifactClasses`, and `deploy.sh` (and the `harness:add-runtime` scaffold that generates it) reads that descriptor instead of hardcoding which targets get the corpus. Cursor and antigravity descriptors set:

```jsonc
"deploy": {
  "artifactClasses": ["instructions", "config", "hooks", "agents", "scripts"],  // +scripts (was absent)
  "scriptsLanding": "~/.cursor/scripts/global",        // cursor
  // "scriptsLanding": "~/.gemini/antigravity/scripts/global",  // antigravity
  "scriptsCorpus": [                                    // the JS gate corpus the artifactClass MUST ship
    "scripts/global/megalint/**",
    "scripts/global/event-schema-v3.js",
    "scripts/global/log-redaction.js",
    "scripts/global/emit-event.js",
    "scripts/global/hamr-provider-wrapper.js"
  ]
}
```

Concretely, the cursor/antigravity deploy branches stop short-circuiting on `scripts` and gain (generated by the scaffold, mirroring the copilot `deploy_files` and codex `tree` mechanisms):

```bash
# cursor / antigravity branch, after the existing hooks+agents rsync, BEFORE exit 0:
if class_enabled "$TARGET" scripts; then
  $APPLY && { mkdir -p "$SCRIPTS_LANDING"; rsync -a "$ROOT/scripts/global/" "$SCRIPTS_LANDING/"; \
    echo "ok scripts/global -> $SCRIPTS_LANDING (#3411 artifactClass:scripts)"; } \
    || echo "(dry run) Would deploy scripts/global -> $SCRIPTS_LANDING"
fi
```

#### Companion registry extensions the artifactClass makes mandatory

Shipping the corpus is necessary but not sufficient for `full`; the corpus must also be *verified present* and *runnable*. The same descriptor-driven change extends (via the scaffold, §4):

- **`hamr-sync-verify.js` `TARGETS`** — today `copilot` + `codex` only. Add `cursor` → `~/.cursor/scripts/global` and `antigravity` → `~/.gemini/antigravity/scripts/global`, plus `REVIEW_TARGETS`. Without this, the corpus could silently drift on the two new runtimes.
- **`runtime-side-effect-guard.js` `ALLOWLIST`** — today `vscode-extension` (phantom — §5.3) + `codex` + `claude-code` only. Add `copilot`, `cursor`, `antigravity` so the now-present guard does not deny their own command IDs as `unknown-runtime`.
- **`deploy-manifest.js` / `verify-deploy.js` / `deploy-atomic.js` / `hook-parity-check.js` / `state-store-parity-check.js`** target arrays — add cursor + antigravity so the manifest/verify chain attests the corpus landed.
- **npm script surface** — add `deploy:manifest:cursor`, `deploy:verify:cursor`, `sync:cursor`, and the antigravity equivalents (today only copilot/codex/claude exist for manifest/verify; cursor/antigravity have no reverse-sync at all).

After this change, every `scripts/global`-backed feature cell for cursor and antigravity is **reachable** and required to probe `full`; none is eligible for `structural-NA` (a deployable corpus is not structurally impossible).

### 2.2 CURRENT PARITY GAP MATRIX (REBUILT, AC-R2)

Cell legend (aligned to the §2.1 schema enum):
**full** = deployed & probe-verified · **partial** = present with a documented gap/stub · **absent** = a real gap that MUST be driven to `full` (uniform-full-parity; never silently tolerated) · **structural-NA(sub)** = genuinely host-impossible, carrying a `substituteTest` whose own cell probes `full` (the `sub` names it).

> Reading note under the binding adjudication (§2.3): every `absent` below is a **Phase-1 work item**, not an accepted state. Cursor/antigravity `scripts/global` cells that were `absent` in iter-1 are re-stated as **absent → reachable via artifactClass:scripts** (§2.4), and are NOT re-labeled NA.

| Surface / feature-family | claude-code | copilot | codex | cursor | antigravity |
|---|---|---|---|---|---|
| **Runtime detection (primary env marker)** | full | **absent** (#3041 — no PRIMARY marker; AI_AGENT/HAMR_TEAM only) | full | full | full |
| **Signer registry entry (per-role ed25519)** | full | full | full | **partial** (aliasSeed only, no per-role keys) | full |
| **GitHub actor→team map** | full | full | **absent** | full | **absent** |
| **Hook config file present** | full (settings.json) | full (global-standards.json) | full (runtime-hooks.json) | full (.cursor/hooks.json) | **partial** (.antigravity/hooks.json; wiring unconfirmed) |
| **PreToolUse state-backed gates** | **absent** (no state_store; substitute candidate = settings.json-hook + CI baton-authority-merge — must be declared + probe full to qualify, else gap) | full | full | **absent** (#3086 Phase-2) | **partial** (tool names partial; wiring unconfirmed) |
| **PostToolUse full coverage (incl. Bash)** | full | full | full | **partial** (afterFileEdit misses Bash) | **partial** |
| **PreCompact anchor** | full | full | **partial** (unconfirmed) | **structural-NA**(sub: periodic-anchor-re-injection — *must* probe full) | **structural-NA**(sub: periodic-anchor-re-injection) |
| **Subagent governance inject** | **partial** (unconfirmed) | full | **partial** (unconfirmed) | **partial** (session_context, not subagent_inject) | full |
| **State store deployment** | **absent** (not-deployed, reads ~/.copilot; drive to full or declare tested substitute) | full | full | **absent** (#3086 Phase-2) | full |
| **Session registration (foreign-writer attr)** | full | **absent** | **absent** | **absent** | **absent** |
| **Megalint validator set deployed** | full (via deploy:claude) | full | full (~/.codex/devenv-ops/scripts) | **absent → reachable** (artifactClass:scripts ships corpus to ~/.cursor/scripts/global) | **absent → reachable** (artifactClass:scripts ships corpus to ~/.gemini/antigravity/scripts/global) |
| **event-schema-v3 / log-redaction / emit-event deployed** | full | full | full | **absent → reachable** (artifactClass:scripts) | **absent → reachable** (artifactClass:scripts) |
| **HAMR provider wrapper deployed** | **partial** (present but not in sync-verify TARGETS) | full | full | **absent → reachable** (artifactClass:scripts) | **absent → reachable** (artifactClass:scripts) |
| **HAMR activation (HAMR_TEAM value)** | full | full | full | **partial** | **absent** (no HAMR_TEAM value — add) |
| **HAMR sync-verify coverage** | **absent** (not in TARGETS — add) | full | full | **absent** (add to TARGETS w/ artifactClass) | **absent** (add to TARGETS w/ artifactClass) |
| **Routing runtimeKinds entry** | full | full | full | **absent** | full |
| **Lane policy / governance-rules applicability** | full | full | full | **partial** (absent from most rule lists) | full |
| **Deploy target (deploy.sh)** | partial (no skills/agents/wiki) | full | full | **partial** (no scripts/wiki today → +scripts via artifactClass) | **partial** (no scripts/wiki today → +scripts via artifactClass) |
| **Reverse sync target** | full | full | full | **absent** (add sync:cursor) | **absent** (add sync:antigravity) |
| **Atomic deploy / manifest / verify** | full deploy; **partial** (no manifest variant chained) | full | full | **absent** (no npm variant — add) | **absent** (no npm variant — add) |
| **xteam MCP register** | full | full | full | full | full |
| **xteam leader-election VALID_TEAMS** | full | full | full | **absent** | full |
| **Skill/command adapter coverage** | full (45, +3 claude-only) | full (42) | **partial** (1 command; skills via ~/.agents/skills) | **absent** (0 — #3086) | **partial** (5/45) |
| **Agent persona coverage** (8 canonical `agents/*.agent.md`) | full (11 `.claude/agents/*.md` = 8 canonical + 3 adapter-only: `it.md`, `red-team.md`, `router-policy.md`) | full (8 canonical via rsync) | **absent** (0; script router only — drive to full or declare task-router.js substitute probing full) | full (Copilot variant via rsync) | **partial** (3) |
| **Wiki read path** | full (~/.copilot/wiki) | full | full (~/.codex/...) | **absent** | full (~/.copilot/wiki) |
| **Wiki search script deployed** | **absent** (null) | full | full | **absent → reachable** (artifactClass:scripts ships wiki-search.js) | **absent → reachable** (artifactClass:scripts) |
| **Doc-coverage block (Collaborator)** | full | full | full | **partial** | **partial** |
| **Operator memory / cross-orch promotion** | full (native) | **absent** (wisdom/project promotion path must reach full, or operator-memory declares it as substitute probing full) | **absent** | **absent** | **absent** |
| **Event emitter / observability surfaces** | full | full | full | **absent → reachable** (artifactClass:scripts ships emit-event.js + event-schema-v3.js) | **absent → reachable** (artifactClass:scripts) |
| **Dashboard server / panels** | **structural-NA**(sub: HAMR observability routes — must probe full) | full (host) | **structural-NA**(sub: HAMR observability) | **structural-NA**(sub: HAMR observability) | **structural-NA**(sub: HAMR observability) |
| **Multi-agent VENDOR_ICONS recognition** | full | full | full | full | full |
| **Runtime side-effect guard ALLOWLIST** | full | **absent** (add) | full | **absent** (add w/ artifactClass) | **absent** (add w/ artifactClass) |
| **Cross-runtime injection guard knownTeams** | full | full | full | **partial** | full |
| **Cross-runtime byte-identical artifact test** | full | full | full | full | full |
| **orchestrator-compatibility.spec KNOWN array** | full | full | full | **absent** | full |
| **governance-manifest.schema targets enum** | full | full | **absent** | **absent** | full |
| **harness-self-test adapter_exemptions** | full | full | full | **absent** | **absent** |

#### Notable real gaps (re-stated under uniform-full-parity)

1. **Copilot detection (#3041)** — Copilot has no PRIMARY env marker in `detect-runtime.js` (COPILOT_OTEL_* deliberately excluded as workspace-injected); falls to `unknown` unless `AI_AGENT`/`HAMR_TEAM` set, which cascades to signer-team auto-resolution failure and exclusion from `runtime-side-effect-guard` ALLOWLIST. Under uniform-full-parity this is a **gap to close** (T2.6/T2.5), not a tolerated quirk: register a Copilot PRIMARY marker OR canonicalize the AI_AGENT/HAMR_TEAM contract as a `substituteTest` that itself probes `full`.

2. **Cursor/antigravity `scripts/global` corpus (the largest reclassified cluster)** — every megalint validator, `event-schema-v3`, `log-redaction`, `emit-event`, `hamr-provider-wrapper`, and `wiki-search` cell for these two runtimes was `absent` in iter-1 because `deploy.sh` `exit 0`s before the corpus copy. Per the binding adjudication these are **absent → reachable**: the `scripts` artifactClass (§2.4) ships the corpus, `hamr-sync-verify` TARGETS + manifest/verify arrays attest it, and the cells are then required to probe `full`. **None is eligible for `structural-NA`** — a deployable corpus is not host-impossible.

3. **Antigravity enforcement plane** — state root exists in `runtime_paths.py` but no canonical hook-wiring config is confirmed; HAMR_TEAM value, provider-wrapper, actor-map, side-effect ALLOWLIST, harness-self-test exemptions all `absent`. All are reachable (config-file + registry adds) and must be driven to `full` (T2.5), not waived.

4. **Cursor Phase-2 (#3086)** — zero skill/command surface, state_store not-deployed, no reverse sync, absent from routing runtimeKinds, leader-election VALID_TEAMS, governance-manifest targets enum, harness-self-test exemptions, orchestrator-compatibility KNOWN array. All are `absent` (reachable via the scaffold/registry adds, T2.4), not NA.

5. **The ONLY genuine `structural-NA` candidates** are: (a) **PreCompact-anchor** on cursor/antigravity (those hosts expose no PreCompact event) — eligible iff the periodic-anchor-re-injection substitute is declared and its own cell probes `full`; and (b) **dashboard host server** on the four non-copilot runtimes — eligible iff the HAMR observability-routes substitute probes `full`. Every other prior-draft "structural difference" re-classifies to `absent`/`partial` and is in scope to drive to `full`.

6. **Lease path discrepancy** (`.dashboard/cross-team-leases.json` vs `~/.megingjord/cross-team-leases.json`) and **A4 wisdom-isolation deploy leak** (deploy.sh ships `wiki/wisdom/project/` into `~/.copilot/wiki/`) remain correctness bugs orthogonal to the parity model (T1.5 / §5.4).

#### CURSOR RECONCILIATION NOTE — manifest "#3086 COMPLETE" vs verified code-registry absence (AC-R2)

The Cursor gap characterization above (this §2.2 matrix, and the §0 / §4 / §6 references that depend on it) reports Cursor as **`absent` across multiple code registries**. That characterization is **disk-verified and correct for the CODE registries**. It nonetheless stands in **direct, load-bearing contradiction** with the parity manifest `inventory/orchestrator-governance-parity.json`, which asserts (line 53-54):

> `"cursor": ["Phase 1 (#3085) + Phase 2 (#3086) COMPLETE — all 12 #1912 surfaces parity-complete or documented-waiver. …"]`

The two cannot both be true as written. The reconciliation, fact-by-fact (verified at HEAD):

| Surface | Manifest assertion | Verified CODE reality | Source of truth (disk) |
|---|---|---|---|
| leader-election VALID_TEAMS | implied parity-complete | **cursor ABSENT** — `['claude-code', 'codex', 'copilot', 'antigravity']` | `scripts/xteam-mcp/leader-election.js:6` |
| runtime-side-effect-guard ALLOWLIST | implied parity-complete | **cursor ABSENT** — keys are `vscode-extension` (phantom — §5.3), `codex`, `claude-code` | `scripts/global/runtime-side-effect-guard.js:7-10` |
| orchestrator-compatibility KNOWN array | implied parity-complete | **cursor ABSENT** (per §2.2 matrix row) | `tests/orchestrator-compatibility.spec.js` |
| governance-manifest.schema targets enum | implied parity-complete | **cursor ABSENT** — `["copilot", "cline", "claude-code", "continue", "antigravity"]` (note codex also absent; cline/continue are stale placeholders) | `inventory/governance-manifest.schema.json:34` |
| routing-provider-adapters runtimeKinds | implied parity-complete | **cursor ABSENT** — `["antigravity", "claude-code", "codex", "copilot"]` | `scripts/global/routing-provider-adapters.json:4-8` |

**Disposition (binding for this deliverable):** the **manifest's "#3086 COMPLETE — all 12 surfaces parity-complete or documented-waiver" assertion is aspirational / stale-pending-verification**; it is NOT corroborated by the live code registries. The §2.2 matrix is the **disk-truthful** view and is authoritative here; the matrix does **not** overstate the gaps — the gaps are real and present at HEAD. The manifest entry was evidently written against a planned/intended end-state (or against surfaces — `.cursor/hooks.json` wiring, HAMR_TEAM, agents deploy, wiki cross-read — that genuinely did land) and was **not reconciled down to the per-registry code reality** before being marked COMPLETE; some of its "documented-waiver" claims (e.g. for VALID_TEAMS / ALLOWLIST / runtimeKinds membership) have **no corresponding tested-substitute waiver** in code under the §2.1 schema, so they do not satisfy the uniform-full-parity escape hatch (§2.3).

**Phase-1 reconciliation requirement (AC-R2 carry-forward):** Phase-1 MUST reconcile `inventory/orchestrator-governance-parity.json` to the code reality — either (a) drive the absent Cursor registry memberships to `full` (T1.4 / T2.4 register cursor in VALID_TEAMS, ALLOWLIST, runtimeKinds, governance-manifest enum, KNOWN array) and only THEN let the manifest assert COMPLETE, or (b) downgrade the manifest's COMPLETE assertion to the accurate per-surface status with explicit, §2.1-schema-conformant tested-substitute waivers for any surface deliberately left non-`full`. A manifest that claims COMPLETE while the live registries it should mirror exclude the runtime is exactly the hand-enumerated-parity drift class the AC-R1 machine-readable catalog + §5.5 parity-matrix hard-gate exist to make impossible — the parity matrix, once it consumes the SSoT catalog, would itself flag this manifest entry as a declared-`full`-probes-absent **hard fail**.

---

## 4. ONE-STEP ONBOARDING ARCHITECTURE (AC-R4) — REVISED

> **Binding adjudication applied (§2.3)**: the parity model is UNIFORM FULL PARITY. Where a surface is structurally unreachable for a runtime because `deploy.sh` does not ship it, the resolution is to extend `deploy.sh` / `deploy-atomic.js` with an `artifactClass` that ships it — NOT to tier the runtime down. Documented tested-substitute exceptions are permitted only where the surface is genuinely structurally impossible, and the substitute must itself probe `full`. The cross-model panel's tiered lean is overridden by client directive (G1). This adjudication is non-negotiable and must not be re-litigated in Phase-1.

### 4.1 The problem this solves

Today, adding a runtime requires manual edits to **at least 14 disjoint surfaces**, and the uniform-full-parity adjudication exposes **6 more** — a true fan-out of **20 surfaces**. `inventory/orchestrator-governance-parity.json` lists cursor as a named runtime but it is absent from eight of the fourteen original surfaces. Every surface is an independent opportunity for a missed registration.

| # | Surface | Canonical file(s) | Observed gap |
|---|---|---|---|
| 1 | Runtime PRIMARY env marker | `scripts/global/detect-runtime.js` PRIMARY array | Copilot absent — no entry; `COPILOT_OTEL_*` deliberately excluded |
| 2 | Team/model signature registry + ed25519 per-role keys | `inventory/team-model-signatures.json` teams[] + perRoleKeys[] | Cursor: aliasSeed only, no perRoleKeys |
| 3 | Registry version rehash | `scripts/global/registry-version.js --write` | Must re-run after every signatures edit; not automated |
| 4 | GitHub actor→team map | `inventory/github-actor-team-map.json` | codex and antigravity actor logins absent |
| 5 | Orchestrator governance parity manifest | `inventory/orchestrator-governance-parity.json` (runtimes, deployTargets, runtimeEventNotes, stateStoreParity.runtimes, wikiDocsParity.runtimes) | stateStoreParity for cursor/claude-code marked not-deployed without tested substitute |
| 6 | Routing provider adapter runtimeKinds | `scripts/global/routing-provider-adapters.json` runtimeKinds | Cursor absent |
| 7 | Governance rules cross-runtime applicability | `config/governance-rules.yaml` cross_runtime_applicability per rule | Cursor absent from multiple rule lists |
| 8 | Harness self-test adapter_exemptions | `inventory/harness-self-test-registry.json` adapter_exemptions | Cursor and antigravity absent |
| 9 | Governance manifest schema targets enum | `inventory/governance-manifest.schema.json` targets enum | Codex and cursor absent; cline/continue stale placeholders |
| 10 | Runtime compatibility matrix | `config/runtime-compatibility-matrix.yml` | Must add row per runtime |
| 11 | Deploy + reverse sync targets | `scripts/deploy.sh` + `scripts/sync.sh` + npm scripts | No sync:antigravity / sync:cursor; deploy:apply default = copilot+codex only |
| 12 | Atomic deploy + manifest + verify + parity arrays | `deploy-atomic.js` runtimes[] + `deploy-manifest.js` TARGET_DIRS + `verify-deploy.js` + `hook-parity-check.js` DEPLOY_TARGETS + `state-store-parity-check.js` KNOWN_STATE_ROOTS + `hamr-sync-verify.js` TARGETS | hamr-sync-verify TARGETS = copilot+codex only; claude-code absent from hook-parity-check DEPLOY_TARGETS |
| 13 | xteam MCP registration + leader-election | `scripts/global/xteam-mcp-register.js` jobs map + `scripts/xteam-mcp/leader-election.js` VALID_TEAMS | VALID_TEAMS = [claude-code, codex, copilot, antigravity] — cursor absent. (leader-election lives under `scripts/xteam-mcp/`, NOT `scripts/global/`) |
| 14 | Runtime allowlists, known-teams, VENDOR_ICONS, KNOWN array, perspective registry, hook config dir, adapter dirs | `runtime-side-effect-guard.js` ALLOWLIST + `cross-runtime-injection-guard.js` knownTeams + `dashboard/js/multi-agent-sessions.js` VENDOR_ICONS + `tests/orchestrator-compatibility.spec.js` KNOWN + **`inventory/team-perspectives.json` teams{}** + per-runtime hook config + adapter dirs | ALLOWLIST = vscode-extension/codex/claude-code only (copilot/cursor/antigravity denied); KNOWN missing cursor; **`team-perspectives.json` has claude-code/codex/copilot/antigravity but cursor absent** — a new runtime invisible to perspective-aware review routing until its lens is registered |

**Six additional surfaces exposed by the uniform-full-parity adjudication**:

| # | Surface | File(s) | Why it must be in the scaffold |
|---|---|---|---|
| 15 | Lefthook install | `lefthook.yml` + `npm run prepare`/`hooks:install` | Lefthook pre-commit/pre-push hooks fire regardless of runtime; a new runtime operator must have them wired or local gates don't fire |
| 16 | Hooks governance-profiles entry | `hooks/governance-profiles.json` | Profiles are runtime-scoped; a missing entry falls through to the default permissive profile |
| 17 | Full instruction-set deploy + harness-goals | `instructions/*.instructions.md` → per-runtime injection path (.cursor/rules/, .antigravity/knowledge/, Claude CLAUDE.md @-imports) | Uniform-full-parity requires every runtime to receive the complete resident instruction set, not a subset |
| 18 | Authorization-profile context | `config/authorization-profiles.json` | Consumed by `auth_profile_enforcer.py`; a missing runtime profile causes fail-open |
| 19 | Goal-tier-state wiring | `hooks/scripts/goal_tier_resolver.py` + `config/metric-catalog.yml` | Goal-tier state drives goal_lens.py; absent wiring causes no-tier default |
| 20 | Per-runtime config-dir + config file scaffold | `~/.{runtime}/` dir + hook config file | A runtime whose config-dir doesn't exist at deploy time causes deploy.sh to silently skip artifact installation |

The full onboarding fan-out is therefore **20 surfaces**, not 14.

### 4.2 Data-driven runtime registry (the foundation)

The fundamental fix is to replace the 20 independent hardcoded arrays with **one runtime descriptor** that every consumer reads. The descriptor is committed to `inventory/runtimes/<runtime>.json` and validated against `inventory/runtime-descriptor.schema.json`.

#### 4.2.1 Descriptor schema (normative — Cursor example)

```jsonc
// inventory/runtimes/cursor.json
{
  "$schema": "../runtime-descriptor.schema.json",
  "id": "cursor",
  "team": "cursor",
  "detection": {
    "primaryEnvMarkers": ["CURSOR_AGENT", "CURSOR_TRACE_ID", "CURSOR_WORKSPACE"],
    "aiAgentValue": "cursor",
    "deltaKind": "env-marker"                 // "env-marker" | "ai-agent-value" | "hamr-team" | "hybrid"
  },
  "signing": {
    "aliasSeed": "Cira", "substrate": "cursor-cli", "perRoleKeys": true,
    "perRoleKeyIds": { "manager": "cursor-manager-v1", "collaborator": "cursor-collaborator-v1",
                        "admin": "cursor-admin-v1", "consultant": "cursor-consultant-v1" }
  },
  "homes": {
    "runtimeHome": "~/.cursor", "hookScriptsPath": "~/.cursor/hooks/scripts",
    "configFilePath": "~/.cursor/hooks.json", "stateRoot": "~/.cursor/hooks/state",
    "wikiPath": "cross-runtime-read:~/.copilot/wiki",
    "skillsLanding": "~/.cursor/commands", "agentsLanding": "~/.cursor/agents"
  },
  "deploy": {
    // Uniform-full-parity: ALL classes must be listed. Omitting a class == an unapproved structural-NA.
    "artifactClasses": ["skills", "agents", "hooks", "scripts", "wiki", "instructions", "config"],
    "scriptsLanding": "~/.cursor/scripts/global",       // the §2.4 artifactClass landing
    "configMergeFormat": "json", "mcpServerKey": "mcpServers", "mcpRequiresType": false
  },
  "hookEvents": {                              // runtime-native → harness canonical PascalCase; null = no equivalent
    "sessionStart": "SessionStart", "beforeSubmitPrompt": "UserPromptSubmit",
    "preToolUse": "PreToolUse", "beforeShellExecution": "PreToolUse",
    "afterFileEdit": "PostToolUse", "stop": "Stop",
    "subagentStart": "SubagentStart", "subagentStop": "SubagentStop",
    "beforeMCPExecution": "PreToolUse", "PreCompact": null
  },
  "routing": {
    "runtimeKind": "cursor", "leaderElectionTeam": "cursor", "hamrTeam": "cursor",
    "sideEffectAllowlistCommands": ["cursor.showPolicy", "cursor.help"]
  },
  "github": { "actorLogin": "cursor-agent", "governanceManifestTarget": "cursor" },
  "selfTest": { "adapterExemptions": [], "adapterExemptionRationale": "" },
  "compatibility": { "ghAuth": "session", "hookExecution": "integrated-terminal", "fallbackStrategy": "graceful-skip-advisory" },
  "onboarding": {
    "lefthookInstall": true, "governanceProfilesEntry": true, "authorizationProfileEntry": true,
    "goalTierWiring": true, "instructionSetDeploy": "rules-dir",
    "instructionSetTargetPath": "~/.cursor/rules/megingjord.mdc"
  },
  // Every waiver MUST have: feature, reason, substitute, substituteProbe, approver.
  "parityWaivers": [
    { "feature": "precompact-anchor",
      "reason": "Cursor has no PreCompact event in its hook taxonomy",
      "substitute": "periodic-anchor-re-injection via beforeSubmitPrompt on every 15th turn",
      "substituteProbe": "tests/cursor-precompact-substitute.spec.js",
      "approver": "cross-model-panel" }
  ]
}
```

#### 4.2.2 Copilot detection schema fix (Surface 1, #3041)

**Root cause**: `scripts/global/detect-runtime.js` PRIMARY array has no Copilot entry. `COPILOT_OTEL_*` vars are injected into every workspace terminal by the VS Code extension — present even in a Claude Code session — so they cannot be a PRIMARY signal (correctly documented in that file).

**Resolution (two-part, both required)**:

Part A — Register `AI_AGENT` / `HAMR_TEAM` as the canonical Copilot detection mode (`deltaKind: "ai-agent-value"`). `inventory/runtimes/copilot.json` sets:

```jsonc
"detection": { "primaryEnvMarkers": [], "aiAgentValue": "copilot", "hamrTeamValue": "copilot", "deltaKind": "ai-agent-value" }
```

Part B — `inventory/runtime-descriptor.schema.json` encodes the constraint that when `deltaKind = "ai-agent-value"`, `primaryEnvMarkers` must be empty (a JSON Schema conditional), so the structural constraint is machine-checked, not prose.

No behavioral change to `detect-runtime.js` is required — the `AI_AGENT` check already handles Copilot at `high` confidence when `AI_AGENT=copilot`. The fix makes the contract explicit and machine-checkable. The `runtime-side-effect-guard.js` ALLOWLIST gap (Copilot denied as `unknown-runtime`) is closed by scaffold step 16 (`'copilot': ['copilot.openDashboard','copilot.showPolicy','copilot.help']`). The parity validator recognizes `deltaKind = "ai-agent-value"` + non-empty `aiAgentValue` as equivalent to a passing primary-env-marker probe, changing the Copilot `runtime-detection` cell from `absent` to `full`.

### 4.3 `harness:add-runtime` scaffold

New npm script: `harness:add-runtime -- --id <runtime> --descriptor inventory/runtimes/<runtime>.json [--dry-run]` (dry-run is the default; `--apply` to write). Implementation: `scripts/global/harness-add-runtime.js`. The scaffold is transactional: if any step fails it rolls back all emitted artifacts, using the same `runAtomicDeploy` pattern as `scripts/global/deploy-atomic.js`.

#### 4.3.1 Scaffold algorithm (ordered, all 20 surfaces)

1. **Validate** descriptor against `runtime-descriptor.schema.json` (fail-closed).
2. **Validate waivers**: each `parityWaivers` entry must reference a `substituteProbe` test file that exists in the working tree. Missing probe = abort.
3. **(Surface 1)** If `detection.primaryEnvMarkers` non-empty, append to the PRIMARY array in `detect-runtime.js` via AST patch (recast). If empty (`deltaKind: "ai-agent-value"`), emit a comment block citing the contract.
4. **(Surface 2)** Append team block to `team-model-signatures.json`. If `signing.perRoleKeys=true`, generate four ed25519 keypairs via `governance-artifact-signature.js` keygen, seeded by `HARNESS_SCAFFOLD_SEED`.
5. **(Surface 3)** Run `registry-version.js --write` to rehash.
6. **(Surface 4)** Append actor entry to `github-actor-team-map.json`.
7. **(Surface 5)** Append to all five sub-blocks of `orchestrator-governance-parity.json`.
8. **(Surface 6)** Append to `routing-provider-adapters.json` runtimeKinds.
9. **(Surface 7)** For each rule with `cross_runtime_applicability`, append the new runtime id.
10. **(Surface 8)** Append adapter_exemption to `harness-self-test-registry.json`.
11. **(Surface 9)** Append to `governance-manifest.schema.json` targets enum; advisory-warn stale cline/continue.
12. **(Surface 10)** Append a row to `runtime-compatibility-matrix.yml`.
13. **(Surface 11)** Add `deploy.sh` stanza (`templates/deploy-stanza.sh.tmpl`) + `sync.sh` stanza + `deploy:<id>:apply`/`sync:<id>` npm scripts.
14. **(Surface 12)** Append to six arrays/maps (`deploy-atomic.js` runtimes[], `deploy-manifest.js` TARGET_DIRS, `verify-deploy.js`, `hook-parity-check.js` DEPLOY_TARGETS, `state-store-parity-check.js` KNOWN_STATE_ROOTS, `hamr-sync-verify.js` TARGETS) + `deploy:manifest:<id>`/`deploy:verify:<id>` npm scripts.
15. **(Surface 13)** Append to `scripts/xteam-mcp/leader-election.js` VALID_TEAMS (the AST-patch target lives under `scripts/xteam-mcp/`, NOT `scripts/global/`) + `scripts/global/xteam-mcp-register.js` jobs.
16. **(Surface 14)** Append to `runtime-side-effect-guard.js` ALLOWLIST + `cross-runtime-injection-guard.js` knownTeams + `multi-agent-sessions.js` VENDOR_ICONS + `orchestrator-compatibility.spec.js` KNOWN + `inventory/team-perspectives.json` teams{} (the new runtime's `lens` + `strengths`). Scaffold the hook config at `homes.configFilePath` by translating `hookEvents` through `templates/hook-config.<configMergeFormat>.tmpl`. Create adapter command/agent dirs per `artifactClasses`.
17. **(Surface 15)** If `onboarding.lefthookInstall`, run `npm run prepare`; verify git hooks present.
18. **(Surface 16)** Append runtime-keyed entry to `hooks/governance-profiles.json`.
19. **(Surface 17)** Per `onboarding.instructionSetDeploy`: `rules-dir` writes `instructionSetTargetPath`; `knowledge-items` appends KI entries; `at-import` adds `@instructions/*` imports; `system-prompt` appends governance XML block.
20. **(Surface 18)** Append runtime-keyed entry to `config/authorization-profiles.json`.
21. **(Surface 19)** Append runtime section to `goal_tier_resolver.py` (`templates/goal-tier-wiring.py.tmpl`) + entry to `config/metric-catalog.yml`.
22. **(Surface 20)** `mkdir -p homes.runtimeHome`, create hook config file, scaffold subdirs per `artifactClasses`.
23. **(Catalog)** For each `parityWaivers` entry, write `perRuntime.<id>.status = "waived"` with `approver` + `substitute` + `substituteProbe` (i.e. the §2.1 `substituteTest`) into `inventory/harness-feature-catalog.json`, so the parity test (§5) accepts the waiver as valid rather than flagging it as `absent`.

#### 4.3.2 Uniform-full-parity: `scripts` artifactClass enforcement

The uniform-full-parity adjudication (§2.3) requires `scripts/global/` shipped to every runtime. For runtimes currently missing it (cursor, antigravity), the descriptor's `artifactClasses` includes `"scripts"`, and the new `deploy:<id>:apply` stanza copies `scripts/global/` to `~/.{id}/scripts/global/` — the same pattern used for copilot/codex today (§2.4). This resolves the largest cluster of `absent` cells: `event-schema-v3.js`, `log-redaction.js`, `emit-event.js`, `hamr-provider-wrapper.js`, and the megalint validator set all become reachable on cursor and antigravity.

`artifactClasses` is **required** in `runtime-descriptor.schema.json` (not optional). Omitting `"scripts"` is a schema validation error unless a `parityWaiver` with a tested substitute covers the `scripts-global-gate-corpus` feature.

### 4.4 Golden re-scaffold test (AC-R4 verification gate)

`tests/harness-add-runtime-golden.spec.js` — for each of the five runtimes:

1. Read the committed descriptor `inventory/runtimes/<runtime>.json`.
2. Run `harness:add-runtime --id <runtime> --dry-run` with `HARNESS_SCAFFOLD_SEED=0000…0000` (64 hex zeros) into an isolated temp tree seeded from a snapshot of all 20 surfaces at a known commit SHA.
3. Assert generated artifacts are **content-hash / canonicalized-normalized equivalent** to what is currently committed.

#### 4.4.1 Content-hash / canonicalized-normalized comparison (replaces byte-identical)

iter-1 specified byte-identical reproduction. This is unworkable for non-deterministic material; iter-2 uses canonicalized-normalized comparison:

| Non-deterministic material | Where it appears | Normalization rule |
|---|---|---|
| ed25519 keypairs | `team-model-signatures.json` perRoleKeys[].privateKeyBase64 / publicKeyBase64 | Strip keypair value fields; compare only keyId, team, role structural fields |
| Registry content-hashes | `team-model-signatures.json` registryVersion | Strip registryVersion field entirely |
| ISO-8601 timestamps | `deploy-manifests/*.manifest.json` generated_at, governance-bundle metadata | Normalize to `"__TIMESTAMP__"` |
| User-specific absolute home paths | Any `$HOME` / `/home/<user>/` expansion | Normalize prefix to `"__HOME__"` |
| HMAC signatures | `deploy-manifests/*.manifest.json` hmac_sha256 | Strip hmac_sha256; compare entries[] sha256 file hashes only |

Implementation at `tests/helpers/golden-normalize.js`:

```js
const STRIP_KEYS = new Set(['privateKeyBase64', 'publicKeyBase64', 'registryVersion', 'hmac_sha256']);
const TS_PATTERN = /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z"/g;
const HOME_PATTERN = /\/home\/[^/\s"]+/g;
function normalize(obj) {
  const json = JSON.stringify(obj, (k, v) => STRIP_KEYS.has(k) ? undefined : v, 2);
  const ts   = json.replace(TS_PATTERN, '"__TIMESTAMP__"');
  const home = ts.replace(HOME_PATTERN, '__HOME__');
  return JSON.stringify(JSON.parse(home), null, 2);   // canonical key order
}
module.exports = { normalize };
```

The test compares `sha256(normalize(generated))` against `sha256(normalize(committed))`. A mismatch means either the scaffold drifted from the hand-committed state, or the hand-committed state has structural content the scaffold does not know about — both are regressions to fix.

**Deterministic seed contract**: when `HARNESS_SCAFFOLD_SEED=<hex64>` is set, `governance-artifact-signature.js` keygen uses a seeded PRNG (same `randomFillSync`-with-seed pattern as `baton-fsm-conformance.spec.js` corpus-generate mode). The golden test always passes the all-zero seed so keypair structure is reproducible even though key material is stripped during normalization.

### 4.5 Surface-by-surface scaffold output catalog

| Surface | Scaffold output artifact | Generator / template | Golden test assertion |
|---|---|---|---|
| 1 | detect-runtime.js PRIMARY entry or deltaKind comment | AST patch / comment injection | normalize(PRIMARY array) match |
| 2 | team-model-signatures.json team block + perRoleKeys | governance-artifact-signature.js keygen seeded | strip keypair values; compare structural shape |
| 3 | registryVersion hash (post-write) | registry-version.js --write | skipped in normalization (hash of seeded keys) |
| 4 | github-actor-team-map.json entry | JSON append | full key-sorted comparison |
| 5 | orchestrator-governance-parity.json 5 sub-blocks | JSON deep-merge | full normalized comparison |
| 6 | routing-provider-adapters.json runtimeKinds | JSON append | full comparison |
| 7 | governance-rules.yaml applicability lists | YAML append per rule | full comparison |
| 8 | harness-self-test-registry.json adapter_exemption | JSON merge | full comparison |
| 9 | governance-manifest.schema.json targets enum | JSON schema patch | full comparison |
| 10 | runtime-compatibility-matrix.yml row | YAML append | full comparison |
| 11 | deploy.sh + sync.sh stanzas + package.json scripts | templates/deploy-stanza.sh.tmpl | normalized text (strip timestamps) |
| 12 | 6 JS array/map entries + 2 npm scripts | AST patch per file | normalized JS comparison |
| 13 | `scripts/xteam-mcp/leader-election.js` VALID_TEAMS + `scripts/global/xteam-mcp-register.js` jobs | AST patch | normalized JS comparison |
| 14 | ALLOWLIST + knownTeams + VENDOR_ICONS + KNOWN + hook config + dirs | AST patch + file write + dir creation | file-tree comparison (normalize ts, home) |
| 15 | Lefthook install (side-effect) | npm run prepare | lefthook.yml unchanged; git hooks present |
| 16 | governance-profiles.json runtime entry | JSON merge | full normalized comparison |
| 17 | instruction-set target file | templates/instruction-deploy.<mode>.tmpl | normalized text comparison |
| 18 | authorization-profiles.json runtime entry | JSON merge | full normalized comparison |
| 19 | goal_tier_resolver.py section + metric-catalog.yml entry | templates/goal-tier-wiring.py.tmpl | normalized text comparison |
| 20 | ~/.{runtime}/ directory tree skeleton | mkdir -p + file writes | dir tree presence assertion (home gitignored) |

### 4.6 Goal-lens rationale

**G1** the scaffold IS the governance — a runtime that omits a surface is structurally impossible because all 20 surfaces derive from one descriptor; manual edits without a descriptor update fail the golden re-scaffold test. **G2** the canonicalized-normalized golden test replaces fragile byte-identical comparison with a semantically correct comparison. **G5** `parityWaivers` + `deltaKind` make tier-graceful degradation declarative and machine-checked; uniform-full-parity is the default, structural-NA an explicit approved exception with a tested substitute. **G6** `--dry-run` default + transactional rollback (`deploy-atomic.js#runAtomicDeploy`) prevent partial scaffold writes. **G10** the 20-surface fan-out collapses to one descriptor + one generator.

### 4.7 Phase-1 child ticket decomposition (T2 track — see §6 for the full graph)

The onboarding work is the T2 track. Its children (T2.0–T2.7) are enumerated with `test_strategy`, dependencies, and sequencing in **§6 (T2 — Data-driven registry + scaffold + content-hash golden test)**. Key deltas vs iter-1: T2.0 (descriptor schema before generator) and T2.7 (surfaces 15-20 templates) are new; T2.2 replaces byte-identical with content-hash/canonicalized-normalized; T2.3 ships the `scripts` artifactClass (the §2.4 make-reachable deliverable); T2.6 closes #3041 without a `detect-runtime.js` logic change.

---

## 5. PARITY-TEST-MATRIX + SELF-DEV GUARDRAIL (AC-R5)

> **Parity model (binding, §2.3 — do NOT re-litigate): UNIFORM FULL PARITY.** Every catalog feature flagged `parity: "yes"` must reach `full` on **all five** runtimes. Where a surface is currently *structurally unreachable* (e.g. the `scripts/global/**` JS gate corpus never shipped to cursor/antigravity by `scripts/deploy.sh`), the resolution is to **MAKE IT REACHABLE** (extend `deploy.sh`/the scaffold with the `scripts` artifactClass, §2.4) — **NOT** to tier the runtime down. A documented, tested substitute exception is permitted ONLY where the surface is genuinely structurally impossible (a platform-capability gap such as `PreCompact` on camelCase runtimes), and the substitute must itself probe `full`.

Workstream 4 turns AC-R5/§5–§6 into **five hard gates** plus their advisory-first promotion path.

### 5.0 Verification corrections to iter-1 (load-bearing)

Three iter-1 claims were re-checked against the repo and corrected; the revised gates depend on the corrected facts:

1. **WASM rebuild-and-hash already exists — but is ADVISORY.** iter-1 Appendix B item 10 said "no observed build job." In fact `scripts/global/baton-fsm/build-wasm.js`, `deployedWasmIntegrity()` in `baton-fsm/conformance-runner.js:166` (rebuild + byte-for-byte compare), and `tests/baton-fsm-wasm-integrity.spec.js` (positive + byte-flip negative) all exist and are invoked by `.github/workflows/baton-fsm-conformance.yml`. **But** that job is named `fsm-conformance-advisory`. So §5.2 is **promote-to-blocking + widen-trigger**, not build-from-scratch.

2. **The `runAll()` dispatch gap is real and larger than "~11".** The `megalint/` directory holds **49 `.js` files**; the `VALIDATORS` map in `index.js` registers exactly **27 validator keys** (`manager-handoff`, `collaborator-handoff`, `doc-coverage`, `admin-handoff`, `consultant-closeout`, `signer-fidelity`, `body-ac-truthfulness`, `epic-ac-traceability`, `merge-evidence`, `merge-evidence-pr-gate`, `lint-as-ac`, `workflow-sha-pin`, `test-discoverability`, `signer-format-canonical`, `flaw-emission`, `cross-checkout-destructive`, `soak-language-guard`, `research-first-phase-gate`, `parity-validator`, `cross-team-response-fidelity`, `changelog-fragment-presence`, `admin-merge-exception`, `batch-cancel-evidence`, `fleet-call-lint`, `work-log-sync`, `baton-transition`, `author-team-check`). That anchors the arithmetic: **49 − 1 (`index.js`) − 27 (registered) = 21 non-`index` files absent from the map** (`runAll()` iterates only that 27-key map). Of the 21, five are intentional libraries Of the 21, five are intentional libraries (`artifact-field-extract.js`, `batch-evidence.js`, `doc-coverage-helpers.js`, `work-log-sync-helpers.js`, `signer-registry-check.js`) and several run transitively (`goal-failure-emission.js` + `consultant-rubric-consistency.js` required by `consultant-closeout.js`; `doc-coverage-diff-verify.js` by `doc-coverage.js`). The genuinely **orphaned, tested-but-never-enforced** set is: `fleet-review-required.js`, `registry-tuple-coverage.js`, `sub-issue-preference.js`, `worktree-naming-advisory.js`. `fleet-review-required.js` being unreachable directly contradicts the memory anchor `project_fleet_review_hard_gate` ("3-surface hard gate, Epic #2192").

3. **`baton-gates.yml` does NOT call `runAll()`.** It `require()`s individual validator files inline (`baton-gates.yml:55,178,180,207,249`). So the per-runtime parity question is not "does each runtime run `runAll()`" but "does each enforcement *surface* (runAll, baton-gates inline list, dedicated workflows, `gov-check.js`, CLI) run a **declared, contract-checked** validator set." That reframing drives §5.1.

### 5.1 Validator-dispatch contract as a HARD gate (closes the silent-miss class)

**Gap.** No machine-checkable contract states *which validators each enforcement surface runs*. A validator can be added, tested, and documented as enforcing — yet be invoked by no surface (the four orphans above), or be in `runAll()` but not in the runtime an orchestrator actually executes. The EDD/coverage family compounds this: `scripts/global/escalation-coverage-gate.js`, `governance-audit-coverage.js`, `instructional-coverage-audit.js`, `lint-coverage-metric.js`, `owasp-coverage-audit.js`, `rule-coverage-gate.js`, and `megalint/edd-required.js` are coverage-meta gates living in *two directories* (top-level `scripts/global/` vs `scripts/global/megalint/`) with no single registry asserting they all run.

**Gate — `scripts/global/validator-dispatch-contract.js` + `.github/workflows/validator-dispatch-contract.yml` (required).** Author a committed contract `inventory/validator-dispatch-contract.json` declaring, for every validator under `scripts/global/megalint/*.js` and the named EDD/coverage gates: `id`, `path`, `class` (`baton-artifact|coverage-meta|library|advisory-lint`), `dispatchedBy[]` (`runAll|baton-gates-inline|<workflow>.yml|gov-check|cli|transitive:<caller>`), `enforcementMode` (`blocking|advisory`), `perRuntimeReachable` (for runtimes whose enforcement runs JS — claude-code/copilot/codex today; **cursor + antigravity once §2.4 ships the `scripts` artifactClass**).

Fails CI when: (1) a validator on disk is absent from the contract; (2) a contract entry declares `class != library` but has an **empty `dispatchedBy`** (the orphan class — catches the four orphans); (3) the live `VALIDATORS` map in `index.js` diverges from the contract's `dispatchedBy: ["runAll", ...]` set; (4) a `coverage-meta` validator is not reachable from at least one required workflow.

**Companion fix (T3.5):** wire the four orphans into a real surface (add to `runAll()` if artifact-class, or to a dedicated workflow), so the "no empty `dispatchedBy`" rule passes by *enforcing* them, not reclassifying them as libraries.

Goal-lens: **G1** an enforced-on-paper-but-never-run validator is now impossible. **G2** restores `fleet-review-required` as the hard gate memory claims. **G10** one registry replaces grep-archaeology across `index.js` + 95 workflows.

### 5.2 WASM rebuild-and-hash promoted to a BLOCKING gate (kernel parity)

**Gap.** `baton-fsm/transitions.js` and `kernel.js`/`build-wasm.js` can be edited without rebuilding `kernel.wasm`, silently breaking JS↔WASM kernel parity. The integrity machinery exists (`deployedWasmIntegrity()`), but its workflow `baton-fsm-conformance.yml` is **advisory** and its `paths:` trigger only fires on `scripts/global/baton-fsm/**` and two named spec files.

**Gate — promote `baton-fsm-wasm-integrity.spec.js` to a BLOCKING job + widen trigger.**
1. (Tracked as T3.6.) Split WASM-integrity out of `fsm-conformance-advisory` into a dedicated **required** job `fsm-wasm-integrity` (status check name added to the `baton-authority-merge-gate` ruleset, id 18234114).
2. The job runs `node --test tests/baton-fsm-wasm-integrity.spec.js`, asserting `deployedWasmIntegrity().reason === 'byte-identical'` (positive) and that a flipped byte is detected (negative) — both already implemented.
3. Add a rebuild step `node scripts/global/baton-fsm/build-wasm.js --check` (new `--check` flag: rebuild in-memory, diff committed `kernel.wasm`, exit non-zero on mismatch) + a `package.json` script `"fsm:wasm:check"` (none exists today), for local reproduction.
4. Keep conformance corpus/matrix steps advisory (replay-eval-gated per §5.7); only the **byte-identity** assertion is promoted to blocking — it is a deterministic equality check, not a precision-calibrated heuristic.

Goal-lens: **G1/G2** kernel divergence becomes merge-blocking. **G3** reuses `build-wasm.js` + spec; zero new infra. **G6** the rebuild is hermetic (zero-dep emitter), cannot flake on a toolchain.

### 5.3 Phantom `vscode-extension/` allowlist entry flagged as a correctness bug

**Gap (confirmed).** `runtime-side-effect-guard.js:8` lists `'vscode-extension': ['megingjord.openDashboard','megingjord.showPolicyHint']` in `ALLOWLIST`, and `hooks/governance-profiles.json:16,70` defines a `vscode-extension` profile — but the `vscode-extension/` directory **does not exist** (`ls -d vscode-extension` → ABSENT). The guard allowlists side-effect commands for a runtime that has no artifacts, while real runtimes are partially absent from the same allowlist (`copilot`, `antigravity`, `cursor` fall to `unknown-runtime`).

**Resolution (uniform-full-parity).** Stale-ghost + missing-real-runtime correctness bug (tracked in the T3.7 correctness bundle):
1. File a Phase-1 correctness child to **remove the phantom `vscode-extension` entry** from both `runtime-side-effect-guard.js` ALLOWLIST and `hooks/governance-profiles.json` — OR, if the VS Code extension is a planned/temporarily-removed surface, restore the directory with a governance-profile-backing artifact. (Disposition remove-vs-restore routes to the free cross-model panel, never the client, per `feedback_signoff_routes_to_crossmodel_not_client`.)
2. **Add the three missing real runtimes** (`copilot`, `antigravity`, `cursor`) to ALLOWLIST with their command-id sets, so every catalog runtime probes `full` on the side-effect-guard parity row.
3. Add `tests/runtime-side-effect-guard-allowlist-parity.spec.js`: assert `Object.keys(ALLOWLIST)` is **exactly** the canonical catalog runtime set (no ghost, no missing).

Goal-lens: **G1** the allowlist mirrors the canonical runtime set exactly. **G2** removes a latent authz hole. **G10** the parity spec ties the allowlist to the SSoT catalog.

### 5.4 Standardize the lease path + add A4 wiki-isolation enforcement

**Gap A — lease path discrepancy (confirmed).** `cross-team-lease-registry.js:8` defaults to `DEFAULT_PATH = <cwd>/.dashboard/cross-team-leases.json` (cwd-relative), while `orchestrator-governance-parity.json:205,211,217,232` declares `~/.megingjord/cross-team-leases.json` as the `leasePath` for all three enrolled runtimes and in `sharedCrossCuttingPaths`. `client_arbitration_guard.py:79` + its test reference the `.dashboard/` form. Two physically different files — split-brain.

**Gate — standardize on `~/.megingjord/cross-team-leases.json` + migration validator (tracked in the T3.7 correctness bundle / T1.5).**
1. Change `cross-team-lease-registry.js` `DEFAULT_PATH` to `path.join(os.homedir(), '.megingjord', 'cross-team-leases.json')`, with `MEGINGJORD_LEASE_PATH` override for tests.
2. Author `scripts/global/megalint/lease-path-migration.js` (wired into the §5.1 dispatch contract as `class: coverage-meta`, blocking): scan `scripts/**`, `hooks/**`, `inventory/**`, `tests/**` for literal `.dashboard/cross-team-leases.json` and fail unless inside a migration-shim or allowlisted legacy test. One-time migration shim: on startup, if the registry finds a legacy `.dashboard/` file and no canonical file, copy forward and emit a schema-v3 incident (`pattern_id: lease-path-legacy-migrated`).
3. Update `client_arbitration_guard.py:79` + its test to the canonical path.

**Gap B — A4 wisdom-isolation leak (confirmed).** `deploy.sh:74,87` runs `deploy_dir "$ROOT/wiki" "$COPILOT/wiki"` — copying the **entire** `wiki/` tree incl. `wiki/wisdom/project/` to `~/.copilot/wiki/`, violating `instructions/wiki-knowledge.instructions.md` ("`wiki/wisdom/project/` MUST NOT be distributed cross-project"). No existing test enforces this.

**Gate — `tests/wiki-isolation-a4.spec.js` (blocking) + deploy exclusion.**
1. Fix `deploy.sh` to **exclude** `wiki/wisdom/project/` from the runtime wiki copy (rsync `--exclude='wisdom/project/'` or a per-subdir loop). Apply the same exclusion to the codex wiki target and any future runtime wiki landing — driven by the descriptor's `homes.wikiPath` (§4).
2. The test asserts: (a) `deploy.sh` contains the `wisdom/project` exclusion for every wiki-copy invocation; (b) a dry-run deploy produces a `wiki/` containing `wisdom/global/` but **not** `wisdom/project/`; (c) `wiki-parity-check.js` `SUBDIR_TIERS` marks `wisdom/project` as `runtime-local-only`.

Goal-lens: **G1/G4** A4 isolation is privacy-of-project-context; the leak is a real cross-project bleed. **G6** lease standardization removes a split-brain surface. **G10** both become single-source, test-anchored.

### 5.5 Per-feature × per-orchestrator test matrix as a HARD gate (uniform full parity)

**Gate — `scripts/global/harness-parity-matrix.js` + `.github/workflows/harness-parity-matrix.yml` (required).** Driven by the AC-R1 catalog (`inventory/harness-feature-catalog.json`): for every feature with `parity: "yes"`, for **all five** runtimes, run the probe declared in the feature's `enforcement` block (deployed-file check, registry-membership check, validator invocation, or named test spec) and compare the **live result** to the catalog's declared `perRuntime.<runtime>.status`.

Hard-fail conditions (uniform-full-parity semantics):
- A cell declared `full` that probes missing → **hard fail**.
- A cell declared `absent`/`partial` on a `parity: "yes"` feature → **hard fail** (under uniform full parity, `absent`/`partial` is never terminal — it is a tracked debt that must reach `full`; the matrix reports it as a *required-remediation* failure, distinct from a regression).
- A cell declared `waived`/`structural-NA` is accepted ONLY when ALL hold, else hard fail: (a) genuinely structurally impossible for that runtime (the `PreCompact` class), (b) an `approver` (free cross-model panel, never the client) recorded, (c) a `substitute` named, AND (d) **the substitute itself probes `full`** in the same matrix run (the §2.1 `substituteTest.mustProbeFull` rule). This is the only escape hatch, and it cannot be used to dodge a *reachable-but-unshipped* surface.
- **Structural-unreachable is NOT waivable.** If a probe reports a surface unreachable because deploy never ships it (the `scripts/global/**` corpus on cursor/antigravity), the matrix emits a `make-reachable-required` failure pointing at the deploy `artifactClass` that must be added — it does **not** accept a tier-down.

The workflow extends the existing 6-surface export in `tests/orchestrator-compatibility.spec.js` to **all** catalog `parity: "yes"` features, and supersedes the three partial checkers (`orchestrator-governance-parity.js` [copilot/codex/claude only], `state-store-parity-check.js`, `wiki-parity-check.js`) by consuming the same catalog. Output artifact: `~/.megingjord/harness-parity-matrix-<ts>.json` (schema-v3 G8 surface).

**Make-it-reachable corollary (§2.3 directive, concrete).** To bring cursor + antigravity to `full` on the JS-gate rows, the onboarding scaffold (§4) and `deploy.sh` gain the `scripts` `artifactClass` (§2.4) plus a Node-availability `capabilities.hookExecution` probe. The parity matrix then probes those rows as `full`; if Node is genuinely absent on a runtime, that is the *only* place a tested-substitute (CI-backstop) exception may be declared, and the CI backstop must itself probe `full`.

Goal-lens: **G1** parity is machine-derived from the SSoT catalog. **G2** the matrix catches a runtime silently losing a gate. **G8** the matrix artifact is a first-class observability surface.

### 5.6 Self-dev guardrail: block any change that LOWERS parity + mandatory cross-family review on catalog changes

**Gate A — `scripts/global/megalint/parity-lowering-guard.js` + `.github/workflows/parity-guard.yml` (required, diff-aware).** On any PR touching a catalog `ssotFiles` path or any of the 20 onboarding surfaces (§4), recompute the per-feature parity status at HEAD and at merge-base. **A diff that flips any `full` cell to `partial`/`absent`, or lowers the count of `full` cells for any feature/layer, without a correspondingly-added approved `structural-NA` waiver (meeting all §2.1/§5.5 conditions), is a BLOCKING violation.** Reuses the proven diff-aware net-regression pattern from the readability gate (#1434, `lint-readability:diff`): fail only on net regression vs merge-base, with a **G6 absolute fallback** (full-snapshot parity floor) when the base ref is unavailable. The invariant under uniform-full-parity is strict: parity may only ever go **up or stay flat** — never down.

**Gate B — mandatory cross-family AI review on catalog changes (required, hard).** Any PR modifying `inventory/harness-feature-catalog.json`, `inventory/harness-feature-catalog.schema.json`, `inventory/runtime-descriptor.schema.json`, or `inventory/runtimes/*.json` MUST carry a cross-family review. Wire by adding those paths to the LANES/path set of `scripts/global/megalint/fleet-review-required.js` — which §5.1 simultaneously rescues from its orphaned state, so this gate is the *first real production caller* of that validator (resolving the `project_fleet_review_hard_gate` contradiction). Requirements: reviewer model family ≠ author family; fleet-first dispatch with **qwen-32b** (high-stakes foundational surface, not 7b, per `feedback_fleet_rater_hallucinated_portability_critique`); the review receipt (16-hex `cross_family_receipt`) checked in `COLLABORATOR_HANDOFF`.

Goal-lens: **G1** parity becomes machine-guaranteed AND monotonic. **G2** the cross-family gate prevents a single model family quietly narrowing the contract. **G3** diff-aware reuses #1434 infra; fleet-first review is the $0 lane.

### 5.7 Advisory → blocking promotion via replay-eval (NOT calendar)

Every **heuristic/precision-calibrated** gate above (the dispatch-contract drift heuristics, the parity-matrix probes, the parity-lowering classifier) ships **advisory first** and promotes to blocking only when replay-eval precision ≥ 0.85 against the historical-PR corpus — the established model (`test-floor-replay-eval.js`, `doc-coverage-diff-replay-eval.js`, the wiki drift gate, `prompt-artifact-lint.js`). Concretely:
- Build `tests/fixtures/parity-matrix-corpus.json` (labeled: PRs that genuinely lowered/violated parity vs PRs that legitimately added an approved structural-NA waiver or legitimately shipped a make-reachable artifactClass).
- `scripts/global/harness-parity-replay-eval.js` scores precision/recall; `promotionEligible = precision >= 0.85`, **auto-revoking** if precision drops — never a calendar threshold (per `soak-language-guard.js`, #1771/#1827).

**Exception — deterministic gates skip replay-eval and ship blocking immediately:** the WASM byte-identity check (§5.2), the empty-`dispatchedBy` orphan check + runAll-vs-contract diff (§5.1), the phantom-allowlist exact-set assertion (§5.3), and the lease-path-grep + A4 deploy-exclusion checks (§5.4) are deterministic equality/membership checks with no false-positive surface — blocking from day 0. Replay-eval is only required where a gate classifies *intent*.

Goal-lens: **G1** parity machine-guaranteed. **G2** prevents quality regression. **G3** replay-eval reuses existing corpus infra — zero calendar-wait cost. **G8** every matrix run emits an observability artifact.

---

## 6. PROPOSED PHASE-1 DECOMPOSITION (AC-R6)

> **Parity model is settled (§2.3, client design authority — do NOT re-litigate in Phase-1): UNIFORM FULL PARITY.** Where a surface is structurally unreachable for a runtime — most notably the `scripts/global/**` JS gate corpus which `deploy.sh` does **not** ship to `cursor`/`antigravity` — the Phase-1 resolution is to **MAKE IT REACHABLE** (extend `deploy.sh` + the scaffold with the `scripts` `artifactClass`, §2.4), **NOT** to tier the runtime down or wave it off to "CI-backstop only." A documented, tested-substitute exception is permitted **only** where a surface is genuinely structurally impossible (e.g. `PreCompact` has no event on camelCase runtimes), and the substitute must itself probe `full`. T3 below therefore ships the matrix at full strictness — there is no panel gate on T3's scoring model.

**Tracks** (T1 is the keystone and MUST land before T2/T3 — the catalog is the single source from which onboarding and the parity matrix derive):

- **T1 — Canonical feature catalog + machine-readable schema + registry reconciliation** (SSoT foundation; gates everything else).
- **T2 — Data-driven runtime registry + `harness:add-runtime` scaffold + content-hash golden test** (derive every per-runtime artifact from one descriptor).
- **T3 — Per-feature × per-orchestrator parity-matrix hard-gate + self-dev guardrail + cross-family review + replay-eval promotion + deterministic correctness gates** (machine-guarantee parity, advisory→blocking at ≥0.85 precision).

Every Phase-1 child carries `phase-gate:phase-1`, cites Phase-0 source (`Refs Epic #3411` + this deliverable), is `lane:code-change` (full four-role baton, EDD, doc-coverage block, cross-family preflight), and ships **advisory-first / replay-eval-promoted** for any new heuristic gate (no calendar thresholds). Each cites a `test_strategy` from `instructions/test-methodology-matrix.instructions.md`.

### T1 — Canonical feature catalog + schema + registry reconciliation (land first)

| # | Title (plain imperative ≤72 chars) | Catalog layers / features covered | test_strategy | Dependencies |
|---|---|---|---|---|
| T1.1 | Author canonical harness-feature-catalog JSON and its schema | ALL L1–L19 (~183 de-duplicated rows); `inventory/harness-feature-catalog.json` + `harness-feature-catalog.schema.json` (draft 2020-12, `catalogVersion` content-hash mirroring `team-model-signatures.json#registryVersion`; §2.1 parityCell with required substituteTest); MUST reconcile against `governance/README.md` + its four-invariant lint (`scripts/global/cross-team-contract-check.js`) as the upstream cross-team SSoT | `golden-file` | none (keystone) |
| T1.2 | Define runtime-descriptor schema and back-fill 5 descriptors | L1 detection/signing, L3 hookEvents, L8 deploy/homes/artifactClasses (incl. `scripts`), L11 capabilities/parityWaivers; `inventory/runtime-descriptor.schema.json` + `inventory/runtimes/{claude-code,copilot,codex,antigravity,cursor}.json` round-tripped from current registries | `contract-test` | T1.1 |
| T1.3 | Build catalog reconciler deriving perRuntime cells from live state | L5 validators, L8 registries; one reconciler replacing the 3 disjoint checkers (`orchestrator-governance-parity.js`, `state-store-parity-check.js`, `wiki-parity-check.js`) + `hook-parity-check.js` — reads live registry membership to populate `perRuntime.<rt>.status` | `tdd-pyramid` + `stress-test` | T1.1, T1.2 |
| T1.4 | Reconcile the six enum/registry drift gaps to full parity | L1 actor-map (codex+antigravity); L4/L8 registries: cursor→runtimeKinds, cursor→`scripts/xteam-mcp/leader-election.js` VALID_TEAMS, codex+cursor→governance-manifest targets enum, cursor→governance-rules applicability, cursor+antigravity→self-test exemptions, +`runtime-side-effect-guard.js` ALLOWLIST + `orchestrator-compatibility.spec.js` KNOWN array | `golden-file` | T1.1 |
| T1.5 | Fix lease-path discrepancy and A4 wisdom-isolation deploy leak | L11 lease registry (`.dashboard/` vs `~/.megingjord/cross-team-leases.json`); L7 `deploy.sh` shipping `wiki/wisdom/project/` cross-project (A4 violation) — root-cause correctness fixes (also surfaced as §5.4 / T3.7 bundle) | `tdd-pyramid` | none (independent; can run alongside T1.1) |
| T1.6 | Catalog scripts/global gate corpus reachability as an artifactClass | L5 megalint corpus, L10 `event-schema-v3.js`/`emit-event.js`, L6 `hamr-provider-wrapper.js` — encode a `scripts` / `gate-corpus` artifactClass in the catalog + descriptor so the currently-unreachable JS plane on cursor/antigravity becomes a *deployable surface* (precondition for T2.3's actual shipping). Per §2.3: make-reachable, not tier-down. | `contract-test` | T1.1, T1.2 |

### T2 — Data-driven registry + `harness:add-runtime` scaffold + content-hash golden test

| # | Title (plain imperative ≤72 chars) | Catalog layers / features covered | test_strategy | Dependencies |
|---|---|---|---|---|
| T2.0 | Author runtime-descriptor schema with deltaKind enum + artifactClasses required | L1/L8; `inventory/runtime-descriptor.schema.json`: primaryEnvMarkers-optional, deltaKind enum, `artifactClasses` (incl. `scripts`) required; the generator's input contract | `contract-test` | T1.1 |
| T2.1 | Build harness:add-runtime scaffold generator (dry-run default) | ALL parity-flagged layers — emits every per-runtime artifact (registry entries, hook config, deploy targets, npm scripts, MCP register, adapter dirs) deterministically from catalog + descriptor; collapses the 20-surface hand-edit fan-out (§4) to one generator; transactional rollback; HARNESS_SCAFFOLD_SEED determinism | `tdd-pyramid` + `stress-test` | T2.0, T1.1, T1.2 |
| T2.2 | Add content-hash golden re-scaffold test for 5 runtimes | ALL layers — `tests/helpers/golden-normalize.js` + `tests/harness-add-runtime-golden.spec.js`: for each committed descriptor, run `harness:add-runtime --dry-run` and assert generated artifacts are **content-hash / canonicalized-normalized equivalent** to committed surfaces (strips keypairs/registryVersion/timestamps/home-paths/HMAC). Replaces iter-1 byte-identical. | `golden-file` | T2.1 |
| T2.3 | Extend deploy.sh + scaffold to ship gate corpus to all runtimes | L5/L6/L10 — implement the §2.4 `scripts` artifactClass in `deploy.sh` + `sync.sh` + `deploy-manifest.js`/`verify-deploy.js`/`deploy-atomic.js`/`hamr-sync-verify.js` so megalint + scripts/global JS lands on cursor + antigravity (uniform-full make-reachable). Adds `deploy:<rt>:apply` / `sync:<rt>` / manifest+verify npm variants. | `tdd-pyramid` + `stress-test` | T2.1, T1.6 |
| T2.4 | Close Cursor onboarding gaps by running the scaffold | L8/L9/L3/L7 — dogfood T2.1 to resolve #3086 surfaces: skills/commands adapter dir, state_store deployment, reverse sync, routing runtimeKinds, wiki path, all enum memberships. The generated diff IS the completeness proof. | `golden-file` | T2.2, T2.3 |
| T2.5 | Close Antigravity enforcement-plane gaps via scaffold + descriptor | L3/L6/L1 — hook-wiring config (`.antigravity/hooks.json` PreToolUse/Stop wiring), HAMR_TEAM value, `hamr-provider-wrapper` coverage, actor-team-map entry; verify gates actually FIRE (side-effect-bearing wiring, not just file presence). | `tdd-pyramid` | T2.2, T2.3 |
| T2.6 | Close Copilot detection gap (#3041) with a primary marker / deltaKind | L1 — `inventory/runtimes/copilot.json` with `deltaKind: ai-agent-value` + schema conditional + parity-validator recognition + ALLOWLIST entry; closes #3041 with NO `detect-runtime.js` logic change. | `tdd-pyramid` | T2.0, T2.1 |
| T2.7 | Scaffold surfaces 15-20 (lefthook, governance-profiles, instruction-set, auth-profile, goal-tier, config-dir) | L14/L15/L12/L17/L13/L3 — template authoring + scaffold-step implementation for the six new onboarding surfaces; each has a template + golden assertion | `tdd-pyramid` | T2.1 |

### T3 — Parity matrix hard-gate + self-dev guardrail + cross-family review + replay-eval + deterministic correctness gates

| # | Title (plain imperative ≤72 chars) | Catalog layers / features covered | test_strategy | Dependencies |
|---|---|---|---|---|
| T3.1 | Build per-feature per-orchestrator parity matrix hard-gate | ALL parity-flagged features — `scripts/global/harness-parity-matrix.js` + `harness-parity-matrix.yml`: live-probe each (feature, runtime) cell via the catalog `enforcement` block; declared `full` that probes missing → fail; `structural-NA`/`waived` must have approver + substitute that itself probes `full`; structural-unreachable emits `make-reachable-required`. Generalizes the 3 checkers + the 6-surface `orchestrator-compatibility.spec.js`. Ships advisory-first. | `tdd-pyramid` + `stress-test` | T1.3 |
| T3.2 | Build self-dev parity-lowering guardrail (diff-aware) | ALL layers (watches catalog `ssotFiles` + the 20 onboarding surfaces) — `scripts/global/megalint/parity-lowering-guard.js`: recompute parity vs merge-base; any net regression / `full`→`partial`/`absent` flip without an approved tested-substitute waiver is blocking. Diff-aware net-regression pattern from readability #1434 with G6 absolute fallback. Monotonic-parity invariant. | `tdd-pyramid` + `stress-test` | T3.1 |
| T3.3 | Wire mandatory cross-family review for catalog/descriptor edits | L5 — extend `fleet-review-required.js` LANES/paths so any PR touching `harness-feature-catalog.json`, `runtime-descriptor.schema.json`, or `inventory/runtimes/*.json` requires a cross-family review (reviewer family ≠ author family; qwen-32b fleet-first; 16-hex `cross_family_receipt`). First real production caller of `fleet-review-required.js`. | `contract-test` | T1.1 |
| T3.4 | Build parity-matrix corpus and replay-eval promotion gate | ALL heuristic gates (T3.1/T3.2 promotion) — `tests/fixtures/parity-matrix-corpus.json` (genuine-lowering vs legit-NA, with false-positive/legitimate-waiver as an explicit exclusion class withheld from the precision denominator) + `scripts/global/harness-parity-replay-eval.js`; `promotionEligible = precision >= 0.85`, auto-revoking, **NOT calendar**. Mirrors `test-floor-replay-eval.js`. | `eval-harness` | T3.1, T3.2 |
| T3.5 | Fold validators into a documented dispatch contract + rescue 4 orphans | L5 — `inventory/validator-dispatch-contract.json` + `validator-dispatch-contract.js` + `.yml`; fold in EDD/coverage family (two-directory split); **rescue the 4 orphans** (`fleet-review-required`, `registry-tuple-coverage`, `sub-issue-preference`, `worktree-naming-advisory`) by wiring each to a real surface so empty-`dispatchedBy` is impossible. Empty-`dispatchedBy` + runAll-vs-contract diff are deterministic (blocking day-0). | `contract-test` | none (independent of T1/T2 sequencing) |
| T3.6 | WASM rebuild-and-hash → BLOCKING | L2 — split `fsm-wasm-integrity` into a required job, add `build-wasm.js --check` + `package.json fsm:wasm:check`, widen trigger, add status check to ruleset 18234114. Byte-identity is deterministic → blocking day-0; reuses `deployedWasmIntegrity()` + `tests/baton-fsm-wasm-integrity.spec.js`. | `golden-file` | none (independent) |
| T3.7 | Deterministic correctness bundle (phantom allowlist + lease path + A4) | L8/L11/L7 — phantom `vscode-extension` allowlist exact-set fix (§5.3) + lease-path standardization & migration validator (§5.4 A) + A4 `wiki-isolation-a4.spec.js` & deploy exclusion (§5.4 B). All deterministic membership/grep checks → blocking. May split into 3 siblings if test surfaces diverge (per multi-close anti-pattern). Overlaps T1.5 on lease/A4 — land as one or coordinate. | `tdd-pyramid` | none (independent) |

### Sequencing & dependency graph

**T1 strictly precedes T2 and T3** (catalog is the keystone — both onboarding and the matrix *derive* from it):

```
T1.1 (catalog+schema) ──┬──► T1.2 (descriptors) ──┬──► T1.3 (reconciler) ──► T3.1 ──┬──► T3.2 ──┐
                        │                          │                                 │           ├──► T3.4 (corpus+replay-eval; ≥0.85 → blocking)
                        │                          ├──► T1.6 (gate-corpus class)      └──────────┘
                        ├──► T1.4 (enum drift fixes)                │
                        │                                           ▼
                        └──► T3.3 (cross-family review wiring)   T2.0 (descriptor schema) ──► T2.1 (scaffold) ──► T2.2 (golden test) ──┬──► T2.4 (Cursor)
                                                                                                ▲                                       ├──► T2.5 (Antigravity)
                                                                                             T2.3 (deploy gate-corpus) ─────────────────┤
                                                                                                ▲                                       └──► T2.6 (Copilot #3041)
T1.5 (lease/A4 fix) ── independent ──                                                        T2.3 depends on T2.1 + T1.6                 T2.7 (surfaces 15-20) ◄── T2.1
T3.5 (validator dispatch contract) ── independent ──
T3.6 (WASM → blocking) ── independent ──
T3.7 (correctness bundle) ── independent (coordinates with T1.5) ──
```

- After **T1.1** lands, **T1.2 / T1.4 / T1.5 / T3.3** can proceed in parallel.
- **T1.3** (reconciler) gates **T3.1** (the matrix consumes it). **T1.6** (gate-corpus class) gates **T2.3**.
- **T2.0 → T2.1 → T2.2**; the golden test (T2.2) must exist before any dogfooding (**T2.4/T2.5/T2.6**). **T2.3** (ship the gate corpus) depends on **T1.6 + T2.1**; **T2.4/T2.5** depend on it so the onboarded runtimes actually receive the JS plane. **T2.7** depends on T2.1.
- **T3.1 → T3.2 → T3.4**: the matrix exists advisory-first, the guardrail builds on it, and **T3.4's replay-eval (≥0.85 precision) is the single gate that flips both T3.1 and T3.2 advisory→blocking** — auto-revoking, never calendar.
- **T1.5, T3.5, T3.6, T3.7** are independent and can land any time alongside T1 (T3.5/T3.6/T3.7 are deterministic, blocking day-0; T3.7 coordinates with T1.5 on the lease/A4 overlap).

### Replay-eval promotion model (T3.4 — detail)

- **Corpus construction**: `tests/fixtures/parity-matrix-corpus.json` labels each historical PR sample as `genuine-lowering` (a real `full`→lower flip with no approved substitute — true positive the guardrail SHOULD fire on) or `legit-NA` (a legitimately marked structural-NA with a tested substitute — true negative). **False-positive samples and legitimate-waiver samples are an explicit exclusion class** carried in the corpus but withheld from the precision denominator, so a correct no-fire on a legitimate waiver never counts against precision and a known historical false-positive doesn't inflate it.
- **Scoring**: `harness-parity-replay-eval.js` reports precision/recall + `promotionEligible = precision >= 0.85` and `detectDrift(samples)` for the under-flagging rate, emitting a versioned audit record (mirroring `test-floor-replay-eval.js#auditRecord`).
- **Promotion**: the advisory→blocking flip for `harness-parity-matrix.yml` (T3.1) and `parity-lowering-guard.js` (T3.2) is gated **only** on `promotionEligible`, auto-revoking if precision later drops below 0.85. There is **no N-day soak / calendar threshold** — velocity-relative, replay-eval-calibrated per `instructions/test-methodology-matrix.instructions.md` and the #1771/#1827 lesson. **Deterministic gates (T3.5 empty-dispatch/diff, T3.6 WASM byte-identity, T3.7 membership/grep) bypass this and ship blocking day-0.**

### Cross-cutting Phase-1 requirements

- The catalog (T1.1) and any descriptor change (T1.2, T2.0, T2.x) get the **strongest** independence requirement — T3.3's cross-family hard gate — because the SSoT is the single highest-leverage drift vector.
- All `+stress-test`-flagged children (T1.3, T2.1, T2.3, T3.1, T3.2) target side-effect-bearing gates / generators reading shared state under concurrent CI and parsing adversarial registry/descriptor inputs, per the test-methodology matrix stress-applicability criteria (state mutation + untrusted-input parsing).
- No structural-NA may be self-asserted to dodge parity: per §2.3, every NA must (a) be genuinely structurally impossible and (b) carry a tested substitute that itself probes `full` in T3.1 — enforced mechanically by T3.1/T3.2 and the §2.1 schema, not by reviewer discretion.
- §2.3 parity model is **already adjudicated (uniform full parity, client G1 directive)** — T3.1/T3.2 lock their scoring to uniform-full-parity with the single tested-substitute escape hatch; no `type:research` panel-decision child is needed for the model itself. The free cross-model panel is still used for *per-bug disposition* calls (e.g. remove-vs-restore `vscode-extension/` in T3.7), never the client.

---

## Appendix A — Cross-cluster de-duplication notes (provenance for AC-R1)

Features that appeared in multiple cluster inventories and were collapsed to single catalog rows:
- `detect-runtime.js` — instructions, scripts-global-core, deploy-registry, inventory-config.
- `cross-runtime-injection-guard.js` — scripts-global-core, deploy-registry, state-coordination.
- `team-model-signatures.json` — instructions, scripts-global-core, megalint, inventory-config, baton-authority-tests.
- `baton-artifact-builder.js` / schema — scripts-global-core, baton-authority-tests.
- `orchestrator-governance-parity.json` / `.js` — deploy-registry, inventory-config, ci-workflows, state-coordination, baton-authority-tests.
- `doc-coverage` matrix + validator — instructions, megalint, inventory-config, wiki-docs-memory.
- `hamr-provider-wrapper.js` / sync-verify — instructions, deploy-registry, hamr-routing.
- `wiki-search.js` / parity — wiki-docs-memory, deploy-registry, instructions.
- incidents.jsonl / cache-stats.jsonl surfaces — hooks, observability, state-coordination, hamr-routing.
- `runtime-side-effect-guard.js` — deploy-registry, state-coordination.
- `friction-event.js` / `friction_event.py` JS/Py twins — scripts-global-core, hooks, resilience-coordination (iter-2 addition).
- `goal_tier_resolver.py` / `actuator-engine.js` — hooks, scripts-global-core (iter-2 L13 addition).

## Appendix B — Consolidated open-question register (top, for panel/Phase-1 triage)

> **iter-2 update**: the foundational uniform-vs-tiered question (iter-1 B-1) is **RESOLVED** (uniform full parity, §2.3, client design authority) and removed from the open register. iter-1 B-10 (WASM build job) is **corrected** (the job exists but is advisory; promote-to-blocking is T3.6). Remaining open items below are implementation-scoped, not model-scoped.

1. ~~uniform-full-parity vs tiered-floor~~ — **RESOLVED §2.3** (uniform full parity; binding).
2. Copilot PRIMARY detection marker (#3041): add a marker, or canonicalize the AI_AGENT/HAMR_TEAM contract as the tested path? — leaning canonicalize (T2.6); confirm in Phase-1.
3. Antigravity hook-wiring: is there a canonical config file, or is enforcement intentionally instructional-only? Either way uniform-full-parity drives it to `full` (T2.5) or to a tested substitute.
4. Cursor Phase-2 (#3086): all `absent` cells are reachable via the scaffold (T2.4); confirm none requires a genuine structural-NA.
5. Structural-NA loophole: closed by the §2.1 required-`substituteTest` schema + T3.1 `mustProbeFull` probe; approver is cross-model-panel or manager+admin, never client.
6. Validator dispatch contract: fold the orphans + EDD/coverage family into `inventory/validator-dispatch-contract.json` (T3.5). Disposition of each orphan (runAll vs dedicated workflow) → free cross-model panel.
7. Lease path discrepancy + A4 wisdom-isolation leak (T1.5 / T3.7) — correctness bugs; deterministic gates.
8. `governance-manifest.schema.json` enum staleness (cline/continue present; codex/cursor absent) — advisory-warn + reconcile (T1.4).
9. Operator-memory cross-orchestrator promotion path — drive `wiki/wisdom/project/` promotion to `full` on the other four runtimes, or declare it as operator-memory's tested substitute (§2.3 worked re-classification).
10. ~~WASM kernel rebuild CI~~ — **corrected**: `build-wasm.js` + `deployedWasmIntegrity()` + spec exist but are advisory; promote `fsm-wasm-integrity` to a required blocking job (T3.6).
11. `vscode-extension` phantom allowlist/profile entry (§5.3): remove vs restore — free cross-model panel disposition (T3.7).
12. PreCompact substitute for cursor/antigravity: confirm the periodic-anchor-re-injection substitute design and that its probe resolves `full` (the only genuine structural-NA candidate).

