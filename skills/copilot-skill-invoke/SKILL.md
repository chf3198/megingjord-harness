---
name: copilot-skill-invoke
description: Invoke a governed harness skill from Copilot BYOK via runSubagent or MCP prompt.
argument-hint: "<skill-name> [args]"
user-invocable: true
disable-model-invocation: false
runtime: copilot
category: governance
---

# copilot-skill-invoke — Harness Skill Invocation Wiring

## Purpose

Let VS Code Copilot (BYOK/Agent mode) invoke any wired harness skill through
`runSubagent` or via the MCP prompt surface. Wraps `~/.copilot/skills` entries
— does NOT reimplement them.

## Scope

Resolves, validates, and builds the invocation record for a governed subset of
harness skills. Returns a `prompt` string ready for `runSubagent`.

## Wired skills (governed allowlist)

- `global-task-router` — lane classification
- `role-baton-orchestrator` — baton handoff orchestration
- `role-manager-execution` — manager scope + AC authoring
- `role-collaborator-execution` — implementation + validation
- `role-consultant-critique` — post-execution critique
- `docs-drift-maintenance` — doc drift detection
- `workflow-self-anneal` — process annealing

## Constraints

- Only skills in `WIRED_SKILLS` (see `scripts/global/copilot-skill-invoke.js`) are exposed.
- Adding a skill requires `user-invocable: true` in its `SKILL.md` and operator review.
- Skills with baton-artifact side-effects (signing, label mutation) are NOT wired
  to prevent OA2/OA9 violations from Copilot BYOK sessions.

## Instructions

1. Call `resolveSkill(name)` — verifies the skill is wired and its file exists.
2. Call `buildInvocation(name, args)` — returns `{ prompt, skillFile, hint }`.
3. Pass `invocation.prompt` to `runSubagent` (or surface via MCP prompt).
4. The skill executes in the Copilot context with its own SKILL.md instructions.

## MCP wiring

Register `megingjord-skill-invoke` in `.github/copilot-mcp.json` (per-repo) or
`~/.config/Code/User/mcp.json` (user-level). Each wired skill becomes an MCP
prompt named `skill-<name>`. See `docs/howto/copilot-skill-invocation.md`.

## Verification

```bash
node -e "
const { listWiredSkills } = require('./scripts/global/copilot-skill-invoke');
console.log(listWiredSkills().map(s => s.name));
"
# Expected: array of 7 wired skill names with description/file populated
```

Run `npm test -- --grep copilot-skill-invoke` for unit test coverage.
