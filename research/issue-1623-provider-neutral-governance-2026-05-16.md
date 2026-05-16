# Issue #1623 Provider-Neutral Governance Inventory

## Scope

This inventory covers repo-local instructions, global skills, hooks, bootstrap
scripts, runtime adapters, and wiki references that shape cross-team work.

## Findings

- Shared contract already exists across `role-baton-routing`,
  `sandbox-worktree-governance`, `team-model-signing`, `global-task-router`, and
  `hamr-routing`.
- Provider-specific setup is spread across `AGENTS.md`,
  `.github/copilot-instructions.md`, `.codex/AGENTS.md`, adapter skills, and hook
  runtime helpers.
- The main compatibility risk is not missing Codex support; it is shared prose
  drifting toward one runtime's vocabulary.
- A compact provider-neutral instruction is safer than rewriting every runtime
  file in one pass while other teams are active.

## Contract

`instructions/provider-neutral-governance.instructions.md` is the normalized
contract. It keeps shared rules in one section and runtime setup in Codex,
Copilot, and Claude Code adapters.

## Validation

- `tests/provider-neutral-governance.spec.js` verifies Codex, Copilot, and
  Claude Code adapter coverage.
- The test also verifies that the shared section does not name a single runtime
  more than the others.

Signed-by: Quill Harper
Team&Model: codex:gpt-5.4@openai
Role: collaborator
