# /xteam MCP server — install and verify

`megingjord-xteam` exposes `/xteam`, `/xteam-create`, and `/xteam-status` through MCP.

## Recommended path (automated)

From repo root, registration is handled automatically by deploy apply scripts.
Use `deploy:all:apply` to register all four runtimes:

```bash
npm run deploy:all:apply
```

`npm run deploy:apply` updates Copilot runtime assets and only registers Copilot MCP.

You can also run registration directly:

```bash
npm run mcp:register
```

## Runtime matrix (authoritative)

| Runtime | Config file | Key / method | Scope |
|---|---|---|---|
| Claude Code | `~/.claude.json` | root `mcpServers` JSON merge | user (cross-project) |
| VS Code Copilot | `~/.config/Code/User/mcp.json` | `servers` JSON merge | default profile in this epic |
| Codex | `~/.codex/config.toml` | `[mcp_servers.megingjord-xteam]` TOML block | global |
| Antigravity | `~/.config/Antigravity/User/mcp.json` | `servers` JSON merge | default profile |

## Fallback / advanced manual registration

Use these only if automation is unavailable.

### 1. Claude Code

```bash
claude mcp add megingjord-xteam -- node /absolute/path/to/scripts/xteam-mcp/bin.js
```

Stored in `~/.claude.json`.

### 2. Codex CLI

```bash
codex mcp add megingjord-xteam --env MEGINGJORD_XTEAM_TEAM=codex -- node /absolute/path/to/scripts/xteam-mcp/bin.js
```

Stored in `~/.codex/config.toml`.

### 3. VS Code Copilot

Edit MCP user config (`MCP: Open User Configuration`) and add under `servers`:

```json
{
  "servers": {
    "megingjord-xteam": {
      "command": "node",
      "args": ["/absolute/path/to/scripts/xteam-mcp/bin.js"],
      "env": { "MEGINGJORD_XTEAM_TEAM": "copilot" }
    }
  }
}
```

This epic targets the default profile path `~/.config/Code/User/mcp.json`. For non-default profiles, open that profile's MCP user config via command palette.

### 4. Antigravity

Use CLI add-mcp JSON (or UI equivalent):

```bash
antigravity --add-mcp '{"name":"megingjord-xteam","command":"node","args":["/absolute/path/to/scripts/xteam-mcp/bin.js"],"env":{"MEGINGJORD_XTEAM_TEAM":"antigravity"}}'
```

## Verification

After runtime reload/restart, run:

```text
/xteam-status 1
```

Expected: structured status response (ticket, lead team, role/status context).

## Notes

- Registration verifies config presence; prompt visibility validation is tracked by #2565 and consumed by #2559.
- Non-default VS Code profile discovery is tracked by #2567.
