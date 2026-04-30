# #599 Task: Sandbox worktree governance pack

Type: Task
Status: in-progress
Priority: P1
Area: governance

**Type**: task | **Status**: in-progress | **Priority**: P1 | **Lane**: code-change
**Labels**: type:task, status:in-progress, area:governance, area:scripts, area:instructions

## Summary
Implement concrete controls that keep Copilot/Codex/Claude sandbox worktrees usable
without branch drift or launcher-branch misuse.

## Scope
- Add session bootstrap/reset command for sandbox worktrees.
- Add local branch guard preventing commits on `sandbox/*` launcher branches.
- Add CI governance audit for sandbox freshness and drift.
- Document policy in instructions + runbook + wiki artifacts.

## Acceptance Criteria
- [x] AC1: Launcher reset command exists and creates ticket-linked task branches.
- [x] AC2: Commits on `sandbox/*` are blocked by local governance guard.
- [x] AC3: CI check validates sandbox governance posture.
- [x] AC4: Research + wiki capture includes first-party source links and rollout steps.

## Verification Gates
- **Collaborator**: Scripts and policies implemented.
- **Admin**: lint/workflow checks pass.
- **Consultant**: controls reduce repeat drift pathways.

## MANAGER_HANDOFF
Use launcher branches only as clean session entrypoints; all delivery goes through
ticket-linked feature branches and PRs.

## Team&Model
- Human alias: curtisfranks
- Team&Model: GitHub Copilot + GPT-5.3-Codex
