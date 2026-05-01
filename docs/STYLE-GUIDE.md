# Megingjord Style Guide

Canonical terminology for the Megingjord fleet-ops and AI agent governance system.
Use these definitions consistently across tickets, PRs, comments, and documentation.

## Canonical Terms

### baton

**The GitHub issue that moves sequentially through roles (Manager → Collaborator → Admin → Consultant), serving as the single source of truth for work state.**

**Example:** Issue #329 is the baton for the fleet-resource tooltip feature; each role posts a handoff artifact before the next role begins.

### skill

**A slash command registered in `.claude/commands/` that invokes a named, reusable capability within a Claude Code session.**

**Example:** `/role-manager-execution` triggers the Manager skill to scope a ticket and emit `MANAGER_HANDOFF`.

### fleet

**The collection of Tailscale-connected compute nodes (36gbwinresource, OpenClaw, local Ollama) available for LLM inference via cascade dispatch.**

**Example:** A fleet-lane task is dispatched to the Ollama endpoint on 36gbwinresource before falling back to Haiku.

### agent

**An AI subprocess spawned by Claude Code with a scoped role definition stored in `.claude/agents/`.**

**Example:** The `role-collaborator` agent is invoked to implement scoped changes and emit `COLLABORATOR_HANDOFF`.

### role

**One of four sequential baton positions — manager, collaborator, admin, consultant — each with exclusive execution authority at its stage.**

**Example:** Only the collaborator role is active during `status:in-progress`; admin picks up at `status:testing`.

### lane

**The work-type classification that determines which baton roles are required: code-change (4 roles), docs/research (2 roles), or config-only (2 roles).**

**Example:** A CHANGELOG-only PR uses the docs/research lane, skipping Collaborator and Admin with explicit N/A comments.

### handoff artifact

**The structured string comment (`MANAGER_HANDOFF`, `COLLABORATOR_HANDOFF`, `ADMIN_HANDOFF`, `CONSULTANT_CLOSEOUT`) posted to the linked GitHub issue when a role completes and transitions.**

**Example:** Posting `ADMIN_HANDOFF` on issue #329 after CI passes signals the Consultant role to begin review.

### gate

**A required CI check that must pass on the latest commit before a PR is eligible to merge.**

**Example:** `baton-gates` fails when the linked issue is missing any of the three expected handoff artifact strings.

### cascade dispatch

**The local-first LLM routing strategy that attempts fleet (Ollama) inference first, falls back to Haiku, then Premium Claude, in cost-ascending order.**

**Example:** A six-word config-gen prompt is sent to `cascade-dispatch.js --execute`; if fleet confidence is high the response is used directly without re-generation.

### worktree

**An isolated git checkout in `.claude/worktrees/` that enables concurrent agent work on separate branches without interfering with the main checkout.**

**Example:** A worktree at `.claude/worktrees/feat-329` lets the collaborator agent commit changes to `feat/329-baton-step-resource` while the main session stays on `main`.

## Quick Reference

| Term | Defined in |
|---|---|
| baton | `instructions/role-baton-routing.instructions.md` |
| skill | `.claude/commands/` |
| fleet | `scripts/global/model-routing-policy.json` |
| agent | `.claude/agents/` |
| role | `instructions/role-baton-routing.instructions.md` |
| lane | `instructions/role-baton-routing.instructions.md` |
| handoff artifact | `instructions/role-baton-routing.instructions.md` |
| gate | `.github/workflows/baton-gates.yml` |
| cascade dispatch | `instructions/global-task-router.instructions.md` |
| worktree | `research/concurrent-agent-worktrees-2026-04-24.md` |
