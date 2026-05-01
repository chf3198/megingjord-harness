---
title: "ADR-012: Multi-Agent Worktree Path Governance"
status: Accepted
date: 2026-05-01
supersedes: none
related: [research/concurrent-agent-worktrees-2026-04-24.md, "[[fleet-architecture]]", #736, #738]
---

# ADR-012: Multi-Agent Worktree Path Governance

## Context

Per #736 (Multi-Agent Command Center) research, AI agent extensions
diverge in their worktree behavior:

- **Claude Code Desktop** (April 2026 redesign) unilaterally creates
  `<repo>/.claude/worktrees/<n>/` per session. No opt-out (Anthropic
  issue #50109).
- **Codex / Copilot Chat / Continue.dev** do not auto-worktree;
  forcing them requires a separate VS Code window rooted at the
  worktree path.
- VS Code multi-root workspaces do not give per-extension folder
  isolation; one window = all extensions see all roots.

Without a path convention, harness-managed worktrees would collide
with Claude's `.claude/worktrees/` namespace or pollute the root.

## Decision

**Per-vendor worktree paths follow this convention:**

| Vendor | Path | Manager |
|---|---|---|
| Claude Code | `<repo>/.claude/worktrees/<session-id>/` | Anthropic (auto) |
| Codex | `<repo>/.harness/worktrees/codex/` | Megingjord (`scripts/agent-worktree.sh codex`) |
| Copilot Chat | `<repo>/.harness/worktrees/copilot/` | Megingjord |
| Continue.dev | `<repo>/.harness/worktrees/continue/` | Megingjord |
| Cursor | `<repo>/.harness/worktrees/cursor/` | Megingjord (Tier-A; Cursor's own BG agent worktrees are unaffected) |

Both `.claude/worktrees/` and `.harness/worktrees/` are gitignored
globally (#739 added the entries). Neither is ever committed.

## Consequences

**Positive:**
- Composes with Claude's existing behavior rather than fighting it
- One namespace per vendor; harness scripts know exactly where each
  agent lives without probing
- Conflict-free with vendor-internal subagents (Cursor `/multitask`,
  Copilot CLI `/fleet`) which use their own paths
- Per-repo isolation: when an agent navigates to repo X, the same
  pattern applies — `<repo-X>/.harness/worktrees/<vendor>/`
- Enables Layer 4 (#739) to lease per-vendor build slots and Layer 3
  (#740) to broadcast per-vendor presence

**Negative:**
- Operators must run `npm run agent:worktree -- <vendor>` once per
  vendor per repo before launching that vendor's window
- Vendors that change their internal worktree convention (e.g.
  Anthropic moving away from `.claude/worktrees/`) will require an
  ADR superseding this one

## Alternatives considered

- **Single shared worktree pool** (`<repo>/.harness/worktrees/<id>/`)
  — rejected: Claude wouldn't follow the convention, splitting the
  namespace anyway
- **Out-of-tree worktrees** (`~/.megingjord/worktrees/<repo-hash>/<vendor>/`)
  — rejected: breaks per-repo gitignore discipline; one repo's
  worktree state shouldn't live in the user home dir
- **No convention; per-agent ad-hoc** — rejected: this is the
  status quo and produces the silent branch-switch contamination
  observed during the 2026-04 → 2026-05 development sessions

## Verification

- gitignore covers both prefixes (#739 introduced; this ADR records)
- `scripts/agent-worktree.sh` script implements the convention
  idempotently
- Per-repo: every harness-managed repo follows the same pattern;
  enforced by `npm run setup` template
- Documented in `instructions/concurrent-agent-worktrees.md`
  (existing) and updated to point at this ADR
