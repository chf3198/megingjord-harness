# 4. MCP Servers & Extensions

## 4.1 MCP in VS Code

- Open standard (modelcontextprotocol.io) for AI-to-external systems
- Configured in `.vscode/mcp.json` (workspace) or user profile
- Capabilities: Tools, Resources, Prompts, MCP Apps
- **Sandboxing** (macOS/Linux): restrict filesystem + network
- Trust model: explicit confirmation before first start
- Enterprise: centrally managed via GitHub policies

## 4.2 MCP as Governance Surface

- Sandboxed servers enforce filesystem/network boundaries
- Resources provide read-only context (compliance docs, schemas)
- Prompts standardize common tasks across teams
- Enterprise can allowlist/blocklist servers centrally
- GitHub MCP server: read-only repo access in Agentic Workflows

## 4.3 Copilot Extensions & Chat Participants

- VS Code Chat Participant API for domain-specific experts
- Extensions contribute tools via Language Model Tools API
- Tool calling: LLM orchestrates invocations automatically
- GitHub Apps contribute chat participants cross-platform
- Agent plugins (preview): bundles of skills, hooks, MCP, agents

## 4.4 MCP Sandbox Configuration Example

```json
{
  "servers": {
    "governance": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp/governance-server.js"],
      "sandboxEnabled": true,
      "sandbox": {
        "filesystem": {
          "allowWrite": ["${workspaceFolder}"]
        },
        "network": {
          "allowedDomains": ["api.github.com"]
        }
      }
    }
  }
}
```

## 4.5 Agent Plugins (Preview)

- Bundles: slash commands, skills, agents, hooks, MCP servers
- Distributed via VS Code marketplace
- Single install provides full governance capability package
- Potential delivery mechanism for devenv-ops governance suite
