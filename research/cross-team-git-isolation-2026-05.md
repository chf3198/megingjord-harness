# Phase-0 Synthesis — Cross-Team Git Isolation Protocol

Phase-0 ticket: this synthesis IS the Phase-0 deliverable for Epic #2071.
Date: 2026-05-21
Status: draft v1 — to iterate via cross-family fleet rater before A+ acceptance

## Executive summary

The Megingjord harness runs three AI agent orchestrators (Claude Code, Copilot, Codex) in parallel against a single local repository. Today the cross-team isolation contract is **documentation-only** (CLAUDE.md "do not share this checkout") with advisory tracking (`cross-team-lease-registry.js`). Observed practice this session — main checkout switched mid-flight from `feat/1610-...` to `fix/1596-...` by a third party while three Claude Code tickets were shipping — demonstrates that documentary contracts are not enforced.

2026 industry consensus, validated by 7 independent sources, converges on a four-layer enforcement stack:

1. **Per-agent git worktree** (filesystem isolation; one branch checked out per worktree; sharing the `.git` object store)
2. **Filesystem lock** (`flock`/`fcntl` advisory locks on the checkout root, or per-team lockfile)
3. **Branch namespace per team** (`cc/<type>/<N>-<slug>`, `cp/<type>/<N>-<slug>`, `cx/<type>/<N>-<slug>`) enforced via GitHub ruleset
4. **GitHub ruleset + merge queue** (no direct push to main; required status checks; required reviews; CODEOWNERS coverage)

The harness already has layer 1 partially (14+ worktrees in use, but main is also actively edited) and layer 3 partially (Conventional Commits prefix enforced, but not per-team namespace). Layers 2 and 4 are absent. This Epic ships all four layers.

## R1 — Worktree-based isolation (the load-bearing layer)

The 2026 industry default. Each AI agent runs in its own git worktree, with its own working directory + git index, sharing only the `.git` object store. Git itself enforces that a branch can be checked out in only one worktree at a time — that's the foundational mutual-exclusion primitive.

Key 2026 properties:
- Claude Code v2.1.50 (April 2026) added first-class worktree support via CLI, Desktop app, and custom-agent frontmatter (`isolation: worktree`)
- Industry benchmarks: worktree-based parallel CI reduces total build time by ~63% (24min → 9min)
- Teams running 4-8 concurrent worktrees per developer reliably as of mid-2026
- Worktree creation includes a `.worktreeinclude` file pattern to copy untracked-but-needed files (e.g. `.env.local`) into the fresh worktree

**Harness adaptation**: per-team worktree-root convention. Today the harness has 17 worktrees including 4 mine from this session (`devenv-ops-1943`, `-1944`, `-2038`, `-2048`), 7 Codex (`devenv-ops-codex-*`), 2 Copilot (`devenv-ops-copilot*`), but **also the main checkout itself is treated as a workspace** — which is the contract violation. The fix: main checkout MUST be canonical-only; all teams MUST work in worktrees.

Sources: [Claude Code Docs — Worktrees](https://code.claude.com/docs/en/worktrees); [Augment Code — Multi-Agent Workspace](https://www.augmentcode.com/guides/how-to-run-a-multi-agent-coding-workspace); [Augment Code — Git Worktrees for Parallel AI](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution); [MindStudio — Worktrees Without Conflicts](https://www.mindstudio.ai/blog/git-worktrees-parallel-ai-coding-agents); [The Agentic Blog — Multi-Agent AI Coding Workflow](https://blog.appxlab.io/2026/03/31/multi-agent-ai-coding-workflow-git-worktrees/).

## R2 — Filesystem locks as a backstop

Git worktree isolation prevents BRANCH collisions but does NOT prevent two agents from `cd`-ing into the same checkout. The 2026 industry consensus distinguishes:

- **OS advisory locks** (Unix `flock`/`fcntl`, Windows `LockFileEx`) — soft mutual exclusion that participating processes honor
- **Mandatory locks** — enforced by the kernel; unsupported on Linux without filesystem-specific config
- **Distributed lock services** — centralized lock tracking (Fast.io, Redis, etc.)
- **Pessimistic vs optimistic** — pessimistic suits short tasks (lock-edit-release); optimistic suits long jobs (edit copy + version-check on write)

**Harness adaptation**: per-worktree session-start hook acquires `flock` on `${WORKTREE}/.lock-<team>` before any state-mutating tool call. The lock is advisory but participating: every harness hook (claude-code, copilot, codex) checks for it. The cross-team-lease-registry becomes the canonical lookup; flock is the OS-level backstop. Pessimistic locking model fits because per-ticket sessions are bounded by baton handoffs.

Sources: [Fast.io — Secure File Locks Multi-Agent](https://fast.io/resources/secure-file-locks-multi-agent/); [Alex Lavaee — Multi-Agent Development Environment](https://alexlavaee.me/blog/parallel-agent-sessions-infrastructure-gap/); [Google Scion Multi-Agent Testbed (InfoQ)](https://www.infoq.com/news/2026/04/google-agent-testbed-scion/).

## R3 — Branch namespace per team

Conventional-Commits prefix (feat/fix/hotfix/chore/skill) is necessary but not sufficient for multi-team. The 2026 emerging pattern: team-prefixed branch namespaces (e.g. `cc/feat/1943-three-wiki`, `cp/fix/2010-foo`, `cx/feat/1912-orch-parity`). Two purposes:

1. **Visibility**: a glance at the branch name reveals owning team
2. **Validator gates**: GitHub ruleset can require the team prefix; PR author identity must match; CODEOWNERS can route reviews by team

**Harness state today**: most worktrees follow conventional prefix only (`feat/1943-three-wiki-typology`, not `cc/feat/1943-...`). Some Codex worktrees use `codex` in the worktree root path but not the branch name (e.g. `devenv-ops-codex-1912` checkout has `feat/1912-orchestrator-governance-parity` branch). This mismatch creates ambiguity at merge time and prevents ruleset-based team-aware policy.

**Recommendation**: per-team prefix on the BRANCH NAME (not just the worktree path) — `<team>/<type>/<N>-<slug>` enforced via GitHub ruleset. The team prefix becomes the authoritative ownership signal.

Sources: [ToolsMint — Git Branch Naming Conventions 2026](https://www.toolsmint.com/learn/git-branch-naming-conventions); [Avi Chawla — Anatomy of an Agent Harness](https://blog.dailydoseofds.com/p/the-anatomy-of-an-agent-harness); [ALARA for Agents (arxiv 2603.20380)](https://arxiv.org/pdf/2603.20380).

## R4 — GitHub ruleset + merge queue

The 2026 recommendation: **rulesets** (not legacy branch protection). Rulesets are layerable, scoped, and auditable by anyone with read access — vs legacy branch-protection which is admin-only-view + single-rule-per-branch.

Key 2026 ruleset properties:
- Multiple rulesets can apply simultaneously to the same branch
- Statuses: `disabled`, `evaluate` (audit-mode), `active` — gradual rollout possible
- Bypass actors explicit + audited
- Required status checks at PR + branch level
- CODEOWNERS-driven review requirements
- Merge queue compatibility

**Harness state today (audited):**
- Main branch protection EXISTS but: `required_pull_request_reviews: null` (NO required reviews), `enforce_admins: false`, `allow_force_pushes: false`, 6 required status checks contexts
- No rulesets configured (legacy branch-protection only)

**Required hardening:**
1. Migrate from branch-protection to rulesets (better audit + layerability)
2. Add `required_pull_request_reviews` with `required_approving_review_count >= 1` (the CODEOWNERS or cross-team Consultant)
3. Add CODEOWNERS for governance-critical paths (`scripts/global/*`, `instructions/*`, `hooks/*`)
4. Add ruleset enforcing per-team branch namespace
5. Enable merge queue for main (so parallel agent PRs queue rather than race the build)

**Anti-pattern to avoid**: exempting agent-created changes from existing checks or rulesets — agent PRs MUST pass the same gates as human-authored work per the [GitHub Well-Architected governance recommendation](https://wellarchitected.github.com/library/governance/recommendations/governing-agents/).

Sources: [GitHub Docs — About Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets); [GitHub Docs — Available Ruleset Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets); [Hadosec — 10 Rules of Branch Protection](https://www.hadosec.com/blog/github-branch-protection/); [GitHub Well-Architected — Governing Agents](https://wellarchitected.github.com/library/governance/recommendations/governing-agents/); [InfoQ — GitHub Stacked PRs](https://www.infoq.com/news/2026/04/github-stacked-prs/).

## R5 — Merge queue for parallel agent PRs

When 4+ agents land PRs concurrently, merging serially serialize-by-default produces redundant rebases + CI re-runs. The 2026 pattern is **merge queue** (GitHub's native or Graphite-style stacked PRs):

- Each PR enters the queue with `merge_when_ready`
- Queue processes serially, rebasing each PR on the previous merged tip
- Required status checks re-run on the rebased SHA before merge
- Conflicts surface to the queue head with explicit operator-review prompts

Graphite reports 80% automated conflict resolution for downstream-PR rebasing. The remaining 20% are "conflicts of intent" requiring human/Consultant judgment.

**Harness adaptation**: enable GitHub merge queue on main. Each team's PR enters the queue after consultant-closeout posts. Conflicts get auto-rebased; intent-conflicts pause the queue with a TEAM_QUESTION-style notification.

Sources: [ctx.rs — Why Coding Agents Need a Merge Queue](https://ctx.rs/blog/merge-queue-for-agents/); [Graphite — Merge Queue](https://cms.gitar.ai/graphite-merge-queue-faster-prs/); [Graphite — AI for Merge Conflict Resolution](https://www.graphite.com/guides/ai-code-merge-conflict-resolution).

## R6 — Session-state boundary management

Observed this session: stale state files at `~/.copilot/hooks/state/repo-*.json` carry `admin_ops` and `flags` from earlier sessions and trip the stop-hook on subsequent sessions. The 2026 industry consensus:

- **Ephemeral by default**: per-session state lives in a microVM-style sandbox; teardown destroys it
- **Reset-and-return**: every session ends with reset to provisioned state, so next session begins clean
- **Explicit persistence**: only state declared persistent survives session boundary

**Harness adaptation**: per-session state file (not per-checkout). Session-start hook rotates `~/.copilot/hooks/state/repo-<hash>.json` → `~/.copilot/hooks/state/archive/repo-<hash>-<session-id>.json` and creates a fresh state. The cross-team-lease registry remains the only cross-session persistent record.

Sources: [BuildMVPfast — Stateful AI Runtimes 2026](https://www.buildmvpfast.com/blog/stateful-ai-runtime-agent-memory-operating-system-2026); [Indium — Persistence Strategies 2026](https://www.indium.tech/blog/7-state-persistence-strategies-ai-agents-2026/); [Fast.io — Tool State Persistence](https://fast.io/resources/ai-agent-tool-state-persistence/); [AWS — Bedrock AgentCore Persistent Filesystem](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-persistent-filesystems.html).

## R7 — Stash hygiene + dangling-work accounting

Observed this session: 10 dangling stashes across `main` (×3), `feat/1758-...`, `fix/1542-...`, `feat/1271-reland`, `chore/cc-review-of-cx-1271`, `feat/1273-...`, `chore/1103-...`, `feat/868-...`. Stashes are operator-flow rescue artifacts; persistent stash accumulation indicates sessions ending without proper shipping.

**Harness adaptation**: pre-session-start audit emits a warning if `git stash list` shows >2 stashes OR any stash >7 days old. Auto-archive: stashes older than 30 days move to `~/.megingjord/stash-archive/` with their metadata for rescue rather than living in `.git/stash`. Per-team stash quarantine: stashes tagged with team identifier in their message can't leak across teams.

Sources: extrapolated from filesystem-residue cleanup patterns (R6).

## R8 — Conflict typology — text vs intent

Critical 2026 distinction: not all conflicts are textual. Two classes:

1. **Text conflicts**: same file, same lines, different changes. Resolvable via 3-way merge or auto-rebase. ~80% of Graphite's automated resolution.
2. **Intent conflicts**: one agent moves toward a new abstraction; another extends the old one. No textual overlap, but the system ends up inconsistent. ~20% of conflicts; ALL of the painful ones.

**Harness adaptation**: text conflicts handled by merge queue + Graphite-style auto-rebase. Intent conflicts require **spec-driven task decomposition** (operator-side discipline) — Manager scope MUST declare which abstraction layer is owned. When two Managers claim conflicting layers, cross-team TEAM_QUESTION resolves before either Collaborator picks up.

Sources: [MindStudio — Multi-Agent Parallel](https://www.mindstudio.ai/blog/claude-code-agent-teams-parallel-workflows); [MindStudio — Parallel Agentic Development Playbook](https://www.mindstudio.ai/blog/parallel-agentic-development-playbook); [Graphite — AI for Merge Conflict](https://www.graphite.com/guides/ai-code-merge-conflict-resolution).

## R9 — Anti-patterns to avoid (2026 industry consensus)

| Anti-pattern | Why bad | Source |
|---|---|---|
| Treat main checkout as a workspace | Cross-team filesystem race; the harness's #1 observed gap | [Augment Code](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution) |
| Disable required reviews on main | Removes the cross-team Consultant gate | [Hadosec](https://www.hadosec.com/blog/github-branch-protection/) |
| Exempt agent PRs from existing checks | Agent-authored code MUST pass the same gates as human | [GitHub Well-Architected](https://wellarchitected.github.com/library/governance/recommendations/governing-agents/) |
| Allow >2 agents to share an `.env` or config file | Token-budget-exhaustion attack surface; per-source content-trust required | [Augment Code Multi-Agent](https://www.augmentcode.com/guides/how-to-run-a-multi-agent-coding-workspace) |
| Bypass merge queue for "small" changes | Queue order determines rebase coherence; bypass breaks the contract | [ctx.rs](https://ctx.rs/blog/merge-queue-for-agents/) |
| Skip stash hygiene | Long-lived stashes carry old state into new sessions | extrapolated (R7) |

## Threat model — 8 cross-team collision modes

Per Epic #2071 AC-R4, enumerate the collision surface:

| # | Mode | Severity | Frequency | Mitigation layer |
|---|---|---|---|---|
| 1 | Main checkout shared as workspace | HIGH | Frequent | R1 (worktree) + R2 (flock) |
| 2 | Branch checked out in 2 worktrees simultaneously | HIGH | Rare (git refuses) | R1 (git built-in) |
| 3 | Stale state file carries previous session admin_ops | MEDIUM | Per-session | R6 (session-boundary reset) |
| 4 | Dangling stashes accumulating across sessions | LOW | Continuous | R7 (stash hygiene) |
| 5 | Cross-team-lease bypass via direct `cd` | HIGH | Possible | R2 (flock backstop) |
| 6 | Cross-team config file race (`.env`, `package.json`) | HIGH | Possible | R1 (worktree isolation) |
| 7 | Force-push to shared branch (e.g. main, develop) | CRITICAL | Already blocked | R4 (ruleset) — verified `allow_force_pushes=false` |
| 8 | Intent conflict (text-clean but semantically inconsistent) | MEDIUM | Per-Epic | R8 (spec-driven decomposition + Manager TEAM_QUESTION) |

## Design proposal — four-layer enforcement stack

### Layer 1 — Per-team worktree-root convention (mandatory)

- Each runtime team has a declared worktree-root prefix: `cc-` (Claude Code), `cp-` (Copilot), `cx-` (Codex)
- Worktree path convention: `${HOME}/devenv-ops-<team>-<ticket>` (e.g. `~/devenv-ops-cc-1943`, `~/devenv-ops-cp-2010`, `~/devenv-ops-cx-1918`)
- Main checkout `${HOME}/devenv-ops/` is CANONICAL ONLY — must stay on `main` branch; pre-tool guard rejects branch switches
- Audit gate: `worktree-governance-audit.js` enforces the convention; CI gate `worktree-naming-required` fails PRs whose source worktree name doesn't match `<team>` prefix

### Layer 2 — Filesystem advisory lock (flock backstop)

- Every harness hook invocation acquires `flock -n ${WORKTREE_ROOT}/.harness-lock` before any tool call that mutates state
- Lock holder writes `${WORKTREE_ROOT}/.harness-lock` body: `{team, session_id, ticket, acquired_at}`
- Pre-tool guard rejects tool calls if lock owner differs from current session OR if lock is stale (>4h)
- Main checkout has its own lock; only canonical operations (`main`-branch read, fetch) are allowed

### Layer 3 — Per-team branch namespace

- New convention: `<team>/<type>/<N>-<slug>` (e.g. `cc/feat/1943-three-wiki`, `cp/fix/2010-bar`, `cx/chore/2014-baz`)
- GitHub ruleset enforces the prefix
- CODEOWNERS routes reviews by team
- Backward-compat: existing flat `<type>/<N>-<slug>` branches accepted but deprecated; new branches MUST carry team prefix

### Layer 4 — GitHub ruleset + merge queue

- Migrate from legacy branch-protection to rulesets
- Add required PR reviews (Consultant-from-other-team OR CODEOWNERS) — currently null, must be ≥1
- Enable merge queue on main; PRs queue after consultant-closeout
- Add CODEOWNERS for `scripts/global/*`, `instructions/*`, `hooks/*`, `inventory/team-model-signatures.json`
- Run rulesets in `evaluate` mode for 1 week of replay-eval, then promote to `active`

## Replay-eval against this session's 3 collisions

| Collision | Layer 1 prevents? | Layer 2 prevents? | Layer 3 prevents? | Layer 4 prevents? |
|---|---|---|---|---|
| Main on `feat/1610-...` mid-session | YES (main canonical-only) | YES (lock) | n/a | n/a |
| Main switched to `fix/1596-...` by third party | YES (main canonical-only) | YES (lock) | n/a | n/a |
| Stale `admin_ops.merge=false` on main state file | n/a (R6 separate) | n/a | n/a | n/a — handled by Layer 5 (session-boundary reset) |

Layer 5 (session-state boundary) is a fifth layer per R6; not in the "four-layer stack" because it's session-state hygiene, not git protocol.

**Layer 5 addition for v2**: per-session state file rotation. Session-start hook rotates `~/.copilot/hooks/state/repo-<hash>.json` → archive + creates fresh.

## Phase-1 child slate (provisional, gated by A+ closeout)

| C# | Title | Lane | test_strategy | Layer |
|---|---|---|---|---|
| C1 | Per-team worktree-root convention validator + worktree-governance-audit.js extension | docs-research | drift-lint | 1 |
| C2 | Main checkout pre-tool-guard: reject branch switches; enforce canonical-only | code-change | tdd-pyramid + stress-test | 1 |
| C3 | Filesystem flock acquisition in harness hooks (claude-code + copilot + codex parity) | code-change | tdd-pyramid + stress-test | 2 |
| C4 | Per-team branch namespace ruleset + GitHub Action validator | code-change | tdd-pyramid + golden-file | 3 |
| C5 | CODEOWNERS file for governance-critical paths | docs-research | drift-lint | 3 |
| C6 | GitHub ruleset migration (branch-protection → rulesets) with evaluate-then-active rollout | code-change | golden-file | 4 |
| C7 | Required PR review activation (currently null); add Consultant-from-other-team requirement | docs-research | manual-verify | 4 |
| C8 | Enable GitHub merge queue on main; document team-aware queue ordering | code-change | golden-file | 4 |
| C9 | Per-session state file rotation; archive at session boundary | code-change | tdd-pyramid | 5 |
| C10 | Stash-hygiene pre-session-start audit | code-change | tdd-pyramid | 7 |
| C11 | Cross-team TEAM_QUESTION protocol formalization for intent-conflict resolution | docs-research | drift-lint | 8 |
| C12 | Migration docs: how to convert existing flat-prefix branches to team-prefix | docs-research | drift-lint | 3 |

## Goal-lens mapping (G1-G10)

| Goal | Contribution |
|---|---|
| G1 Governance | Cross-team git protocols become enforced not documentary; main checkout canonical-only |
| G2 Quality | Merge queue prevents bad PRs from racing through CI; required reviews from other team |
| G3 Zero Cost | Worktree-share-object-store costs no extra disk; flock has zero runtime cost; rulesets free |
| G4 Privacy | Per-team filesystem isolation prevents cross-team file leakage |
| G5 Portability | Worktree pattern works across CC/Copilot/Codex; flock is universal Unix; rulesets are GitHub-universal |
| G6 Resilience | Each team's session can fail without contaminating other teams; main checkout stays canonical |
| G7 Throughput | Worktree-based parallel CI reduces total build time ~63% per industry benchmark |
| G8 Observability | Lockfile contents + cross-team-lease registry + worktree-governance-audit emit team ownership signal |
| G9 Interoperability | Same worktree pattern across all three runtimes; ruleset is GitHub-native cross-team-compatible |
| G10 Maintainability | Documented + enforced protocols replace 10+ stashes of ad-hoc workaround |

## v1 self-evaluation

| Goal | Score | Rationale |
|---|---|---|
| G1 Governance | 10 | All four layers + Layer 5 enforced; main canonical-only resolves the #1 observed gap |
| G2 Quality | 9 | Merge queue + required reviews + ruleset evaluate-mode rollout |
| G3 Zero Cost | 10 | Zero net cost; worktrees share object store; flock free; rulesets free |
| G4 Privacy | 9 | Filesystem isolation strong; cross-team lockfile observable |
| G5 Portability | 10 | Pattern is universal; works on all three runtimes |
| G6 Resilience | 9 | Layer 5 session-state reset + Layer 2 lock prevent cascading; degradation ladder for stash + state |
| G7 Throughput | 9 | Parallel CI gains + merge queue serial-tail; net positive on throughput |
| G8 Observability | 9 | Lockfile + lease + audit-emit all observable |
| G9 Interoperability | 10 | Cross-runtime via worktree primitive + GitHub rulesets |
| G10 Maintainability | 9 | Documented + validator-enforced; replaces ad-hoc workaround patterns |

**v1 mean: 9.4 / 10. Above A+ threshold (9.0).**

## Open questions for fleet rater iteration

1. Is Layer 2 (flock) belt-and-suspenders excessive given Layer 1 (worktree)? Or load-bearing because Layer 1 doesn't prevent same-checkout `cd`?
2. Is the per-team branch namespace `<team>/<type>/<N>-<slug>` the right shape, or should it be `<type>/<team>-<N>-<slug>` to preserve Conventional Commits primary prefix?
3. For Layer 4 merge queue: is GitHub's native merge queue sufficient, or do we need Graphite-style stacked PRs for >4-concurrent-team-PR throughput?
4. For Layer 5 session-state rotation: is per-session rotation overkill, or essential for the stop-hook stale-state class?

## Citations (all 2026; ≥10 distinct sources)

1. [Claude Code Docs — Worktrees](https://code.claude.com/docs/en/worktrees) — official adapter
2. [Augment Code — Multi-Agent Workspace](https://www.augmentcode.com/guides/how-to-run-a-multi-agent-coding-workspace)
3. [Augment Code — Git Worktrees for Parallel AI](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution)
4. [MindStudio — Worktrees Without Conflicts](https://www.mindstudio.ai/blog/git-worktrees-parallel-ai-coding-agents)
5. [The Agentic Blog — Multi-Agent AI Coding Workflow 2026-03](https://blog.appxlab.io/2026/03/31/multi-agent-ai-coding-workflow-git-worktrees/)
6. [Nimbalyst — Best Worktree Tools 2026](https://nimbalyst.com/blog/best-git-worktree-tools-ai-coding-2026/)
7. [Fast.io — Secure File Locks Multi-Agent](https://fast.io/resources/secure-file-locks-multi-agent/)
8. [Alex Lavaee — Multi-Agent Development Environment](https://alexlavaee.me/blog/parallel-agent-sessions-infrastructure-gap/)
9. [Google Scion Multi-Agent Testbed (InfoQ 2026-04)](https://www.infoq.com/news/2026/04/google-agent-testbed-scion/)
10. [ctx.rs — Why Coding Agents Need a Merge Queue](https://ctx.rs/blog/merge-queue-for-agents/)
11. [Graphite — Merge Queue + AI Conflict Resolution](https://www.graphite.com/guides/ai-code-merge-conflict-resolution)
12. [GitHub Docs — About Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
13. [GitHub Well-Architected — Governing Agents](https://wellarchitected.github.com/library/governance/recommendations/governing-agents/)
14. [Hadosec — 10 Rules of Branch Protection](https://www.hadosec.com/blog/github-branch-protection/)
15. [InfoQ — GitHub Stacked PRs 2026-04](https://www.infoq.com/news/2026/04/github-stacked-prs/)
16. [BuildMVPfast — Stateful AI Runtimes 2026](https://www.buildmvpfast.com/blog/stateful-ai-runtime-agent-memory-operating-system-2026)
17. [Indium — Persistence Strategies 2026](https://www.indium.tech/blog/7-state-persistence-strategies-ai-agents-2026/)
18. [ToolsMint — Git Branch Naming Conventions](https://www.toolsmint.com/learn/git-branch-naming-conventions)
19. [Multi-Agent Harness Synthesis (arxiv 2604.20801)](https://arxiv.org/html/2604.20801v1)
20. [ALARA for Agents (arxiv 2603.20380)](https://arxiv.org/pdf/2603.20380)

## References — internal

- Epic body: #2071
- Adjacent: #1554 (cross-checkout-destructive guard worktree branch)
- Adjacent: #2061 (Manager-post-research-child protocol — shares stale-state pattern)
- Adjacent: #2070 (flaw-emission validator softening — shares over-trigger pattern)
- Documentary contract: CLAUDE.md Concurrent-session safety section; research/concurrent-agent-worktrees-2026-04-24.md
- Existing primitives: scripts/global/cross-team-lease-registry.js, scripts/global/worktree-active-session-lock.js, scripts/global/worktree-governance-audit.js, scripts/global/megalint/cross-checkout-destructive.js
- Observed evidence: this session 2026-05-21 — main checkout switched mid-flight from feat/1610-... to fix/1596-... by third party while three Claude Code tickets shipped
