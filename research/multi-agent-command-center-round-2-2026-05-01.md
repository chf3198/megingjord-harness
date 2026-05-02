# Multi-Agent Command Center — Round 2 Research (2026-05-01)

**Epic:** #736
**Status:** Round 2 research complete; second design discussion pending
**Client decisions absorbed from Round 1:**
- Stay on git (no `jj` migration)
- Tier-A + Tier-B (with Codex prioritized as Tier-B), Tier-C opt-in only
- Full-stack design-correct end state, single epic
- Layered enforcement is mandatory
- Coordination server can use localhost only if resources permit; otherwise out-of-the-box thinking required
- Multi-agent dashboard overhaul agreed
- Karpathy LLM Wiki kept in the loop

## Round-2 critical findings

### 1. The "instinctive worktree separation" you observed is REAL — and one-sided

**Confirmed via search of the local git status:** the `.claude/worktrees/` untracked entry that has appeared throughout this session is not an artifact of the harness — it's **Claude Code Desktop's unilateral, non-disable-able session worktree behavior** introduced in the April 2026 Anthropic redesign. CCD creates a fresh `<repo>/.claude/worktrees/<name>/` per session and runs inside it.

- Open Anthropic issue **#50109** requests an opt-out — confirms the behavior is unilateral, not negotiated.
- Copilot CLI offers worktree mode but **opt-in at session start** (the user must select Worktree vs Workspace).
- OpenAI Codex and GitHub Copilot Chat have **no documented automatic worktree behavior** for local same-window sessions.

**Implication:** Claude Code already does Layer 2 isolation for its own sessions. The harness should **detect and respect** the existing `.claude/worktrees/` directory rather than fight it; the design should compose with Anthropic's choice rather than override it.

### 2. VS Code 1.109 (Jan 2026) introduced a unified Agent Sessions view

- Hosts Claude / Codex / Copilot side-by-side in **one window**.
- Each agent uses its provider's SDK + harness independently.
- **No documented context sharing** between providers and **no documented collision/concurrency rules** — providers operate autonomously.
- Local agents explicitly run with **"No (direct workspace)" isolation** by default — they all touch the same files.
- Only **background** agents auto-isolate via worktrees; **cloud** agents isolate via remote VMs.

**Citation:** `code.visualstudio.com/blogs/2026/02/05/multi-agent-development`

### 3. The proposed VS Code API surface for agents

- `vscode.proposed.chatSessionsProvider.d.ts` migrated from provider-based to **controller-based** model (`createChatSessionItemController` replacing `registerChatSessionItemProvider`).
- A separate proposed API contributes dynamic chat resources (prompt files, custom agents, instructions, skills).
- `microsoft/vscode#302362` adds **`chat.agent.onPermissionRequest`** for permission resolution and remote approval routing.
- **No documented "agent identity," "agent presence," or "agent registry" proposed API** as of 2026-Q2.

**Implication:** the harness has to **build its own presence layer** because the platform doesn't provide one yet. We can hook into `chatSessionsProvider` to *contribute* sessions but cannot *enumerate* peer extensions' sessions.

### 4. GitHub Copilot CLI `/fleet` (April 2026)

Copilot CLI shipped its own multi-agent orchestrator: `/fleet` decomposes an objective into independent work items and dispatches to multiple subagents in parallel. Copilot CLI reached GA in February 2026 with Plan mode, Autopilot, and parallel specialised subagents (Explore, Task, Code Review, Plan).

**Implication:** Copilot has its own internal multi-agent story but **no cross-vendor coordination contract**. Our harness is filling the cross-vendor gap.

### 5. OpenAI Codex MultiAgentV2 — the most explicit cross-session contract

- `agents.max_threads` (default 6 concurrent threads)
- `agents.max_depth` (default 1, prevents deep recursion)
- Subagents are first-class with root/subagent hints
- **Sandbox contract is the co-existence story**: `sandbox_mode = "workspace-write"` + `approval_policy = "on-request"` is the documented preset for low-risk local automation
- Per-profile `cwd` controls + active-profile metadata exposed to clients

**Implication:** Codex's permission profiles + `cwd` give us a **real Tier-B identity surface** to bind to the harness. We can pin a Codex profile to a specific worktree path and the sandbox enforces the boundary.

### 6. Claude Code multi-agent bug surface

Beyond #31787 from Round 1, Round 2 surfaced more:
- **#28829** — `.claude.json` corruption from non-atomic read-modify-write across N concurrent sessions (toolUsage, clientDataCache, projects all share one global file with no locking; regression in v2.1.59)
- **#49166** — `/effort` leaks across concurrent sessions instead of being session-scoped
- **#39808** — globally-enabled plugins load in every instance and conflict on channel ownership
- **#54393** (April 28 2026) — post-mortem cataloguing 12 multi-agent coordination bugs in a single overnight autonomous cycle

**Implication:** the harness has to **defend against shared-state corruption**, not just file-level conflicts. The `.claude.json` global state means even sessions in separate worktrees can corrupt each other through that one file.

### 7. MCP 2026-Q2 evolution — discovery added, presence not

- **SEP-1649 / PR-2127** added `.well-known/mcp.json` server cards for client-side server discovery. Schema uses protocol version `2025-06-18`. Targeted for the **2026-06 spec release**.
- This is **server-side discovery only** — there is no MCP mechanism for two MCP-using agents in one workspace to see each other.
- Multi-agent coordination is **explicitly out of scope for MCP**.
- The gap is being filled by Google's **A2A protocol** layered on top.

**Implication:** we cannot rely on MCP alone for inter-agent presence. Our coordination server (`mcp_agent_mail` style) is genuinely necessary.

### 8. Industry state of "agent presence in IDE"

- **No formal "agent rendezvous" or "agent presence in IDE" research paper or open standard found** as of 2026-Q2.
- All documented coordination is one of: (a) separate worktrees + separate windows, (b) shared file system as bus (Anthropic's parallel-Claudes pattern), (c) subagent fan-out within one vendor (Cursor `/multitask`, Copilot CLI `/fleet`).
- **Bottom line: same window + same checkout + 3 vendors remains an unsolved coordination problem.**

**Implication:** Megingjord is at the cutting edge here. Either we build the primitive ourselves, or we wait 6+ months for the platform.

### 9. Coordination server hosting comparison (under resource constraints)

| Option | Cold latency | Free quota | State location | Works without persistent host? |
|---|---|---|---|---|
| **Cloudflare Worker + Durable Object** | 10–50 ms | **100k req/day**, 1 GB KV, SQLite-in-DO | Per-DO SQLite | **Yes — fully edge** |
| Termux-on-Tailscale (Android phone) | LAN ~20 ms | $0 if old phone | Local phone SQLite | No — phone must stay charging |
| GCP Cloud Run | ~1–2 s cold | 2M req/mo, 360k vCPU-s | Separate Firestore/GCS | Yes |
| Fly.io | Always-on | **No free tier in 2026 (CC required)** | Volume | Yes (paid) |
| GitHub Actions + issue-comment state | Minutes (sched) | Generous Actions minutes | Issue/PR comments | Yes — degenerate "no server" case |
| PartyKit / Liveblocks | Real-time WS | Free tier metered on MAU | Provider DB | Yes (managed) |

**Recommended: Cloudflare Worker + Durable Object.** Reasons:
- Consumes zero free-model fleet resources (runs at the edge, not Penguin-1 / OpenClaw / 36gbwinresource)
- Survives any host's downtime including phone reboots
- Stateful WebSocket + SQLite per-session in one primitive
- 100k req/day quota is far above the ~5–10 baton transitions/day a single-operator workflow generates
- Already the platform Cloudflare uses for its own remote MCP servers (good docs)
- FastMCP transport — `mcp_agent_mail` works as-is

**Tier-C fallback: GitHub-Actions-as-coordinator.** No infra at all; uses issue comments as KV. Already half of what `manager-ticket-lifecycle` does today.

## Updated 5-layer recommended stack (incorporating Round 2 + client decisions)

| Layer | Tool / Mechanism | Source |
|---|---|---|
| **1** | VS Code Profile + Window per agent (where same-window not required) | Round 1 |
| **2** | Per-agent worktree. **Compose with Claude Code's existing `.claude/worktrees/`** (don't fight it). For Codex/Copilot, harness creates `<repo>/.harness/worktrees/<agent-id>/` and pins via Codex `cwd` profile / Copilot CLI worktree mode. | Round 2 (composition over override) |
| **3** | **Cloudflare Worker + Durable Object** hosting `mcp_agent_mail`-compatible coordination server. Each agent's MCP host connects via FastMCP. TTL-bounded advisory file leases. | Round 2 (resource-constrained hosting) |
| **4** | Local SQLite WAL at `.dashboard/agent-state.sqlite` for sub-second leases (build slot, hook mutex). + Defense against `.claude.json` corruption: per-agent `CLAUDE_CONFIG_DIR` env override. | Round 1 + Round 2 (Claude bug defense) |
| **5** | GitHub issue assignee + role label as ticket-ownership truth (already in place). Fallback Tier-C: GitHub-Actions-as-coordinator if Cloudflare unavailable. | Round 1 |

## Tier policy (with client revisions)

| Tier | Extensions | Stack support |
|---|---|---|
| **A — multi-agent-safe** | Cursor Background Agents, native VS Code MCP host, GitHub Copilot Chat (Jan 2026 multi-session view), Claude Code (worktree-isolated by default), Continue.dev ≥1.0.20 | Layer 1+2+3+4+5 |
| **B — supported with explicit isolation** | **Codex (priority — sandbox-mode + cwd profile binds to worktree)**, Amazon Q Developer, Sourcegraph Cody | Layer 1+2 (forced) + 3+4+5 |
| **C — opt-in with warnings** | Cline / Roo Code (multi-window bugs), Aider (auto-commit aggressive), Tabnine (unknown behavior) | Requires explicit user consent; harness shows warning banner; no tier-C agent gets coordination-server credentials |

## Same-window multi-chat scenario (the user's primary use case)

Round-2 finding #1 means same-window is now well-defined:
- **Claude Code session** runs in `.claude/worktrees/<n>/` automatically
- **Codex session** runs in `.harness/worktrees/codex-<id>/` (harness binds via Codex profile `cwd`)
- **Copilot Chat session** runs in main checkout (no worktree behavior); harness can detect and warn the user to use Copilot CLI worktree mode for non-trivial work
- **Coordination server** mediates between all three via MCP for any cross-session activity (lease for shared file, presence broadcast, baton handoff visibility)
- **Dashboard** shows three lanes — one per active agent — with current branch, current ticket, current file leases held, last activity

## Karpathy LLM Wiki integration

Round-2 findings ingested into wiki via `wiki/sources/multi-agent-command-center-round-2-2026-05-01.md` (see next file). Cross-links: `[[36gbwinresource]]`, `[[openclaw]]`, `[[penguin-1]]`, `[[fleet-architecture]]`, `[[baton-protocol]]`, `[[concurrent-agent-worktrees]]`.

## FINAL ARCHITECTURE LOCK (post round-3 client review)

### Decisions confirmed by client

- **One VS Code window per agent vendor** (Claude / Codex / Copilot / Continue), each rooted at its worktree. Same-window-cross-vendor isolation is impossible per VS Code multi-root semantics + per-vendor pin docs (Codex IDE extension reports `cwd:~/`, Copilot Chat has no documented sub-directory pin, Continue follows IDE workspace root only).
- **One instance per agent vendor** (≤1 Claude, ≤1 Codex, ≤1 Copilot Chat, ≤1 Continue at a time). All five major Claude multi-session bugs (#28829, #49166, #39808, #54393, #31787) require Claude-on-Claude contention; this rule sidesteps them. `CLAUDE_CONFIG_DIR` per-agent override deferred.
- **Per-repo per-vendor worktrees**: `<repo>/.claude/worktrees/<n>/` (Claude self-managed by Anthropic) + `<repo>/.harness/worktrees/<vendor>/` (harness-managed for Codex, Copilot, Continue). Both gitignored. Created on first-touch per repo via pre-prompt / pre-tool hooks.
- **Cloudflare Worker + Durable Object** is optional opt-in coordination host. Default = local SQLite WAL only with "limited mode" banner.
- **Multi-agent dashboard panel split into a separate epic** (per A8 client decision); this epic ships only the coordination plumbing.
- **Cross-repo support**: agent windows may navigate between multiple local repos and push to multiple GitHub remotes in one session (per Copilot CLI behavior). Worktree path discipline scales naturally — every repo this vendor visits gets its own `.harness/worktrees/<vendor>/`.

### Final 5-layer stack

| Layer | Mechanism | Default behavior | Scope |
|---|---|---|---|
| 1 | VS Code Profile + Window per vendor | required for Tier-A and Tier-B | install-time templates |
| 2 | Per-repo per-vendor worktree | always on; Claude self-managed; others via pre-prompt hooks | per-repo |
| 3 | **Optional** Cloudflare Worker + DO MCP coordination | off unless `CLOUDFLARE_WORKER_URL` configured; banner shown when off | per-fleet |
| 4 | Local SQLite WAL (`<repo>/.dashboard/agent-state.sqlite`) | always on; sub-second leases | per-repo |
| 5 | GitHub issue assignee + role label = ticket ownership | already in place | per-issue |

### Tier policy (final)

- **A — multi-agent-safe** (Cursor Background Agents, native VS Code MCP host, GitHub Copilot Chat, Claude Code, Continue.dev ≥1.0.20): full stack support
- **B — Codex priority + supported with forced isolation** (OpenAI Codex via `cwd` profile templating, Amazon Q Developer, Sourcegraph Cody): full stack with Layer 2 mandatory
- **C — opt-in only with warnings** (Cline / Roo Code, Aider, Tabnine): pre-commit hook detects auto-commit signature on protected branches and blocks; no Layer 3 credentials granted

## Open design decisions for second discussion

1. **Cloudflare Worker hosting**: do we proceed with Cloudflare as primary coordination host, or want a deeper look at Termux-on-Tailscale or hybrid? Cloudflare seems unambiguous given resource constraints.
2. **Worktree path discipline**: standard prefix `.harness/worktrees/<agent-id>/` for non-Claude agents (since Claude already uses `.claude/worktrees/`). OK to add this prefix?
3. **Same-window UX**: when user has 3 chats in one VS Code window, should the harness install a status-bar indicator showing each agent's current worktree + ticket? Or rely entirely on the dashboard?
4. **`.claude.json` corruption defense**: per-agent `CLAUDE_CONFIG_DIR` overrides (recommended). Do we make this automatic via VS Code env injection, or document only?
5. **Failure mode when Cloudflare Worker is unreachable**: graceful degradation to local SQLite-only? Or hard fail until reconnected? Recommend graceful with banner.
6. **Codex profile templating**: harness ships a `codex-profile.toml` per agent with cwd + sandbox bound. Agree?
7. **Cline/Aider Tier-C policy enforcement**: do we add a pre-commit hook that detects Aider's auto-commit signature and blocks it on protected branches?
8. **Dashboard multi-agent panel**: ship as part of this epic, or split to a child? Recommend part of this epic so the SSE schema evolution is coherent.

## Sources

Full citations across both research dispatches preserved in epic #736 comments.

Key URLs (Round 2):
- VS Code blog "Your Home for Multi-Agent Development" (Feb 2026): code.visualstudio.com/blogs/2026/02/05/multi-agent-development
- vscode.proposed.chatSessionsProvider.d.ts: github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.chatSessionsProvider.d.ts
- GitHub Blog "Run multiple agents at once with /fleet": github.blog/ai-and-ml/github-copilot/run-multiple-agents-at-once-with-fleet-in-copilot-cli/
- Codex Subagents docs: developers.openai.com/codex/subagents
- Codex Sandbox docs: developers.openai.com/codex/concepts/sandboxing
- Anthropic claude-code #50109 (worktree opt-out request): github.com/anthropics/claude-code/issues/50109
- Anthropic claude-code #28829 (.claude.json corruption): github.com/anthropics/claude-code/issues/28829
- Anthropic claude-code #54393 (12-bug post-mortem): github.com/anthropics/claude-code/issues/54393
- MCP server-card SEP-1649/PR-2127: github.com/modelcontextprotocol/modelcontextprotocol/pull/2127
- Cloudflare Workers free tier: developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Durable Objects pricing: developers.cloudflare.com/durable-objects/platform/pricing/
- mcp_agent_mail repo: github.com/Dicklesworthstone/mcp_agent_mail
