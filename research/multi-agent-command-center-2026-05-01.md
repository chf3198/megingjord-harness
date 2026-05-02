# Multi-Agent Command Center — Research & Design (2026-05-01)

**Epic:** #736
**Status:** Research phase — pending client review before implementation

## Goal

Make VS Code a multi-agent command center where 3–5 AI agent extensions
operate concurrently on the same repo on the same machine without
conflicts.

## VS Code AI agent extension behavior matrix (2026-Q2)

Eleven extensions surveyed. Full citations in epic #736 research dispatch.
Highlights relevant to coordination design:

| Extension | Multi-window safe? | Direct git writes? | Local port | Session ID |
|---|---|---|---|---|
| **GitHub Copilot Chat** (agent mode) | yes | via terminal/agent | none (HTTPS only) | per-window chat IDs |
| **Claude Code** (CLI + ext) | partial — PID lock file in `~/.claude/ide/`; shared `~/.claude/projects/` causes session-disappear bugs | indirect (Bash tool) | **yes** — random 127.0.0.1:high | session UUID + lock-file PID |
| **OpenAI Codex** | unknown — no documented multi-instance contract | yes — sandbox-mode aware | unknown | per-run transcripts |
| **Cursor** (fork) | **best built-in** — Agents Window + v3.2 `/multitask`; isolates branches via worktrees | yes — Background Agents push branches | multiple | `cursor-agent --resume <chatId>` |
| **Continue.dev** | per-window state; LanceDB race fixed in v1.0.20 | indirect | none | assistant config IDs |
| **Cline / Roo Code** | **worst** — global state bug #2550, view collision #807, instance task sync #3514 | yes — generates commit messages, runs `git` | optional 9222 (Chrome remote) | task ID, shared globally (bug) |
| **Aider** (CLI in terminal) | breaks on shared git index | **yes — auto-commits every edit** by default | none | none |
| **Tabnine Agent** | unknown | unknown | unknown | unknown |
| **Amazon Q Developer** | unknown | yes — `@git` tool | unknown | per-window chat |
| **Sourcegraph Cody** | unknown | indirect (Smart Apply) | unknown | conversation IDs |
| **Native VS Code MCP host** (1.99+) | yes | depends on configured server | per-server (stdio or SSE) | server+tool IDs |

Only **Cursor** is designed for multi-agent concurrent operation.
**Cline** is the highest-risk coexistence target. **Aider's** default
auto-commit will fight any other agent on a shared index. **Claude Code**
already uses PID-keyed lock files — closest to a working model.

## Isolation primitive comparison

| Primitive | Isolation strength | Install cost | 2026 verdict |
|---|---|---|---|
| Per-agent VS Code Profile + Window | low (FS still shared) | zero | necessary, not sufficient |
| Per-agent git worktree | medium (`.git/index.lock` shared) | low | breaks down at >5 worktrees |
| `jj` (jujutsu) over git | **high** — concurrent workspaces native; no shared `index.lock`; auto-undo via op log | install one binary | **2026 winner per Panozzo + ezyang writeups** |
| Rootless Podman + Distrobox | very high | one-time setup | use when FS isolation matters |
| Firecracker / Kata microVM | extreme | heavy | overkill for in-tree work |

## Coordination primitive comparison

| Primitive | Crash-safe | Install-agnostic | Sub-second | Verdict |
|---|---|---|---|---|
| `flock` | yes | yes | yes | brittle on NFS/9p/WSL |
| **SQLite WAL** with TTL leases | yes | yes (single file) | yes | **recommended local primitive** |
| Custom PID + heartbeat | partial | yes | yes | reinvents SQLite, poorly |
| **GitHub issue assignee** | yes | yes (cloud) | no (~5000 req/h) | **recommended source-of-truth for ticket ownership** |
| Tailscale-shared lease | yes | needs Tailscale | yes | overkill single-machine |

**Best blend**: GitHub issue assignee = ticket-ownership truth; SQLite WAL
= sub-second coordination locally.

## MCP for inter-agent communication

MCP's 2026-Q2 roadmap explicitly adds agent-to-agent as a first-class
direction. The directly-relevant project:

**`mcp_agent_mail`** (Dicklesworthstone, GitHub) — *"asynchronous
coordination layer for AI coding agents: identities, inboxes, searchable
threads, and advisory file leases over FastMCP + Git + SQLite"*. TTL-bounded
advisory file reservations (default 3600s, renewable). This solves the
*"both agents tried to edit CHANGELOG.md and one lost"* class of failure
without hard locks that would head-of-line block.

`lastmile-ai/mcp-agent` is the other major framework — workflow patterns
(chaining, handoffs) rather than coordination.

## Recommended stack for Megingjord

Five layers, each addressing a specific failure class:

1. **Per-agent VS Code Profile + Window** — disjoint extension sets, settings, tasks per agent. Cleans up extension-state collisions like Cline's global-state bug.
2. **`jj` over `git`** — concurrent worktrees without `.git/index.lock` contention. Existing git users keep their workflow; `jj` operates on the same `.git/` directory and pushes to GitHub as normal git refs. Solves the recurring branch-switch contamination we saw 5+ times this session.
3. **`mcp_agent_mail` MCP server on localhost** — single coordination bus all agents subscribe to. Each agent has a Gmail-style identity + inbox; advisory file leases prevent two agents from writing the same file.
4. **SQLite WAL state file** at `.dashboard/agent-state.sqlite` — sub-second TTL leases for build slots, hook mutexes, worktree-pin claims.
5. **GitHub issue assignee + role label** — already mostly true; the source of truth for *which agent owns ticket N*. Combined with #730/#732 fleet-state work, this becomes a coherent system.

## Failure-class coverage

| Failure observed in this repo | Layer that fixes it |
|---|---|
| Branch silently switches mid-task | Layer 2 (`jj` workspaces don't share an index) |
| Pre-push hook reverts edits during another agent's push | Layer 3 (file lease) + Layer 4 (hook mutex) |
| CI race on baton-gates from simultaneous merges | Layer 4 (build-slot lease) |
| Last-writer-wins on `CHANGELOG.md` / `package.json` | Layer 3 (file lease) |
| Interleaved/lost lines in `.dashboard/events.jsonl` | Layer 4 (write mutex) or per-agent file prefix |
| Stash cross-contamination | Layer 1 + Layer 2 (per-Profile per-worktree) |
| Two agents post handoffs on same issue, race timing gate | Layer 5 (assignee = single owner) |

## Replicability constraint

All five layers must install via existing `npm run setup`:
- Layer 1: VS Code Profiles import — single CLI command
- Layer 2: `jj install` — single binary; can be `brew/winget/apt`
- Layer 3: `mcp_agent_mail` runs as a child of any agent's MCP host
- Layer 4: SQLite is standard library on any platform
- Layer 5: already in place

No layer requires cron, systemd, or an always-on daemon.

## Open design questions for client review

- **Q1.** Do we adopt `jj` as the canonical VCS layer? It is the strongest single-decision item. Tradeoff: contributors learn `jj` (15-min ramp; pushes to GitHub as normal git so external collaborators see plain git). Alternative: stay on git, pay the `index.lock` tax with worktrees.
- **Q2.** Which extensions do we explicitly support vs. block? Recommend a tiered policy:
  - **Tier-A supported** (multi-agent-safe): Cursor Background Agents, VS Code MCP host, GitHub Copilot Chat, Claude Code, Continue.dev (with v1.0.20+).
  - **Tier-B requires per-agent worktree + Profile**: Codex, Amazon Q, Cody.
  - **Tier-C requires opt-in + warnings**: Cline / Roo Code (multi-window bugs), Aider (auto-commit), Tabnine (unknown behavior).
- **Q3.** Where does the MCP coordination server run? Localhost on the dev workstation is simplest. Tailscale-shared if a fleet device should also coordinate.
- **Q4.** Does the dashboard grow a "Multi-Agent Sessions" panel? Strong yes — same SSE stream we already have, plus a per-agent identity column.
- **Q5.** Do we vendor `mcp_agent_mail` in this repo, depend on it as an npm/pip package, or fork? Recommend pin-by-SHA in `inventory/` first; revisit when stable.
- **Q6.** Hooks vs. trust model. Hooks enforce; we should layer enforcement (Layer 3 advisory) before fail-closed (Layer 4 mutex). Two failed acquisitions = fail to user.

## Recommended next steps (post client review)

If client approves direction: spawn 5 implementation child tickets, one per layer, P1 priority, in dependency order (1 → 2 → 4 → 3 → 5/dashboard). Each child uses standard 4-role baton.

If client wants a smaller starting wedge: spawn only Layer 3 (`mcp_agent_mail` integration) + Layer 4 (SQLite leases) as the "prove it works" MVP, defer `jj` and Profiles until measured benefit.

## Sources

Comprehensive citations in epic #736 dispatch comments. Key URLs:

- [Avoid Losing Work with Jujutsu (jj) for AI Coding Agents](https://www.panozzaj.com/blog/2025/11/22/avoid-losing-work-with-jujutsu-jj-for-ai-coding-agents/)
- [Parallel Agents ❤️ Sapling (ezyang)](https://blog.ezyang.com/2026/03/parallel-agents-heart-sapling/)
- [mcp_agent_mail (Dicklesworthstone)](https://github.com/Dicklesworthstone/mcp_agent_mail)
- [VS Code Profiles official docs](https://code.visualstudio.com/docs/configure/profiles)
- [VS Code MCP servers docs](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [Cursor 3.2 Agents Window](https://cursor.com/docs/agent/agents-window)
- [Claude Code VS Code extension docs](https://code.claude.com/docs/en/vs-code)
- [Cline issue #2550 — workspace-scoped state](https://github.com/cline/cline/discussions/2550)
- [Aider git docs](https://aider.chat/docs/git.html)
- [SQLite File Locking and Concurrency](https://sqlite.org/lockingv3.html)
- [MCP 2026 Roadmap — agent-to-agent direction](https://mcpplaygroundonline.com/blog/mcp-2026-roadmap-whats-changing-for-developers)
