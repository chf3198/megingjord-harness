# /xteam MCP server — per-runtime install

The `megingjord-xteam-mcp` server exposes 3 slash-commands (`/xteam`, `/xteam-create`, `/xteam-status`) in any MCP-compatible AI runtime. Install it once per runtime; then the slash commands appear in every chat.

## Prerequisites (all runtimes)

- Node.js ≥ 18
- `gh` CLI authenticated: `gh auth status` returns OK
- Read+write access to the workspace repo (Issues + Labels)
- This repo (megingjord-harness) checked out somewhere — the server lives under `scripts/xteam-mcp/`

## 0. Install dependencies (one-time)

```bash
cd <megingjord-harness-checkout>/scripts/xteam-mcp
npm install
```

Sets up `@modelcontextprotocol/sdk` and other dependencies.

## 1. Claude Code

Run from anywhere:

```bash
claude mcp add megingjord-xteam --command="node /absolute/path/to/scripts/xteam-mcp/bin.js" --env MEGINGJORD_XTEAM_TEAM=claude-code
```

Config lands in `~/.claude/mcp_config.json`. Restart Claude Code to pick up the new server.

## 2. Codex CLI

```bash
codex mcp add megingjord-xteam --command="node /absolute/path/to/scripts/xteam-mcp/bin.js" --env MEGINGJORD_XTEAM_TEAM=codex
```

Config lands in `~/.codex/mcp_config.json`.

## 3. VS Code Copilot

Open Settings UI: Search "MCP Servers" -> Add MCP Server. Or edit `.vscode/mcp.json`:

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

Set `chat.mcp.discovery.enabled: true` in user settings to auto-discover from Claude Desktop instead.

## 4. Antigravity

Open the Agent pane > MCP Servers > Install Custom Server:
- Name: `megingjord-xteam`
- Command: `node /absolute/path/to/scripts/xteam-mcp/bin.js`
- Env: `MEGINGJORD_XTEAM_TEAM=antigravity`

## 5. Gemini CLI

Edit `~/.gemini/settings.json` (higher friction; Phase-1 follow-on `install-xteam.sh` will automate):

```json
{
  "mcpServers": {
    "megingjord-xteam": {
      "command": "node",
      "args": ["/absolute/path/to/scripts/xteam-mcp/bin.js"],
      "env": { "MEGINGJORD_XTEAM_TEAM": "gemini" }
    }
  }
}
```

## Verification

After install + restart, in any chat:

```
/xteam-status 1
```

Expect a structured response with `{ticket: 1, leadTeam: ..., status: ...}`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Slash command not visible | Server not registered, or runtime not restarted | Re-run install + restart the runtime |
| "gh: command not found" | gh CLI missing | Install gh: https://cli.github.com |
| 404 on label-add | Ticket number wrong or no write access | Confirm `gh issue view <N>` works |
| Server crashes on startup | Missing `@modelcontextprotocol/sdk` | `cd scripts/xteam-mcp && npm install` |

## Per-runtime env tuning

| Env var | Default | Purpose |
|---|---|---|
| `MEGINGJORD_XTEAM_TEAM` | `claude-code` | Identifies which team this session represents |
| `MEGINGJORD_XTEAM_PERSPECTIVES` | `inventory/team-perspectives.json` | Override path to perspective lens config |

## Related

- Epic #2486 (parent)
- docs/howto/cross-team-rd-synthesis.md (now uses /xteam by default)
- research/xteam-mcp-design-2026-05-31.md (Phase-0 design)
