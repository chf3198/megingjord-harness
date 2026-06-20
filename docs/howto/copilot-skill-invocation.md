# Copilot Skill Invocation — How-To (Refs #3047)

Wires harness skills (`~/.copilot/skills`) as Copilot-invokable via `runSubagent`
or the MCP prompt surface. Skills are **wrapped, not reimplemented**.

## Quick start

### Option A — MCP prompt (recommended)

1. Register the MCP server (per-repo `.github/copilot-mcp.json` is already present).
2. Reload VS Code (`Developer: Reload Window`) so Copilot picks up the server.
3. In Agent mode, invoke via MCP prompt: `skill-global-task-router` with optional args.

### Option B — runSubagent

```javascript
// In a Copilot Agent tool call or extension:
const { buildInvocation } = require('./scripts/global/copilot-skill-invoke');
const inv = buildInvocation('global-task-router', 'route implement multi-file refactor');
// inv.prompt === '/global-task-router route implement multi-file refactor'
await runSubagent({ prompt: inv.prompt });
```

### Option C — CLI verification

```bash
node -e "
const { listWiredSkills } = require('./scripts/global/copilot-skill-invoke');
console.table(listWiredSkills().map(s => ({ name: s.name, available: !!s.file })));
"
```

## Wired skill catalog

| Skill | Purpose |
|---|---|
| `global-task-router` | Lane classification (free/fleet/premium) |
| `role-baton-orchestrator` | Baton handoff orchestration |
| `role-manager-execution` | Manager scope + AC authoring |
| `role-collaborator-execution` | Implementation + validation |
| `role-consultant-critique` | Post-execution critique |
| `docs-drift-maintenance` | Doc drift detection |
| `workflow-self-anneal` | Process annealing |

## Adding a skill to the wired set

1. Ensure its `SKILL.md` has `user-invocable: true`.
2. Confirm it has no baton-artifact side-effects (OA2/OA9 guard).
3. Add the name to `WIRED_SKILLS` in `scripts/global/copilot-skill-invoke.js`.
4. Add a test case in `tests/copilot-skill-invoke.spec.js`.
5. Redeploy: `npm run deploy:apply`.

## MCP server registration

The `megingjord-skill-invoke` MCP server is registered per-repo via
`.github/copilot-mcp.json`. For user-level (all repos) registration:

```bash
node scripts/global/copilot-skill-invoke-mcp-register.js --target copilot --apply
```

## G5 portability / fallback

- MCP path requires `@modelcontextprotocol/sdk` (installed in `scripts/xteam-mcp/`).
- If MCP is unavailable (`MEGINGJORD_MCP_DISABLED=1`), use Option B (runSubagent)
  or Option C (CLI) — both work without MCP.
- `resolveSkill` / `buildInvocation` are pure Node.js with no network dependency.
