---
name: Sandbox Worktree Governance
description: Governance controls for multi-agent sandbox worktrees used by Copilot, Claude Code, and Codex.
applyTo: "**"
---

# Sandbox Worktree Governance

## Purpose

Prevent cross-agent collisions and branch drift when using dedicated sandbox worktrees.

## Operating Model

- `sandbox/copilot`, `sandbox/codex`, and `sandbox/claude-code` are launcher branches.
- Launcher branches are not delivery branches.
- Delivery work must happen on ticket-linked task branches (`feat/<issue#>-<slug>`, `fix/<issue#>-<slug>`, `hotfix/<issue#>-<slug>`).

## Required Session Start

Before starting implementation in any sandbox worktree:

1. `git fetch origin --prune`
2. Reset launcher branch to `origin/main`
3. Remove local residue (`git clean -fd`)
4. Create and switch to ticket-linked task branch

Preferred command:

- `bash scripts/worktree-session-start.sh <copilot|codex|claude-code> feat/<issue#>-<slug>`

## Forbidden Actions

- Do not commit directly on `sandbox/*` branches.
- Do not open PRs from `sandbox/*` branches.
- Do not keep launcher branches behind `origin/main` between sessions.

## Verification Gates

- Local: pre-commit branch guard blocks commits on `sandbox/*`.
- CI: `worktree-governance-required` must pass.
- Audit command: `npm run governance:worktrees`.

## Escalation

If any sandbox branch is behind or dirty:

1. Stop implementation on that branch.
2. Run session-start reset flow.
3. Resume on a ticket-linked task branch only.
