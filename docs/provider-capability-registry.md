# Provider Capability Registry

Generated from `scripts/global/provider-capability-registry.json`.
Owner boundary: Runtime records describe agent surfaces; provider records describe serving paths.

## Runtimes

| ID | Tools/MCP | Hooks | Agents/Skills | Sandbox/Approval | Cost | Telemetry |
|---|---|---|---|---|---|---|
| codex | yes | yes | yes | strong | provider-mediated | mixed |
| claude-code | yes | yes | yes | strong | anthropic-plan-or-api | mixed |
| copilot | tools-only | yes | yes | cloud-sandbox | plan-limited | estimated |
| openclaw-fleet | custom | harness | no | local-fleet | zero-cost-local | derived |
| hamr | mcp-capable | harness | no | wrapper-mediated | signed-observability | derived |

## Providers

| ID | Tools/MCP | Hooks | Agents/Skills | Sandbox/Approval | Cost | Telemetry |
|---|---|---|---|---|---|---|
| openai-compatible | api-tools | no | no | api-key-scoped | provider-usage | mixed |
| anthropic | api-tools | no | no | api-key-scoped | messages-cache-usage | exact_request |
| ollama | api-tools | no | no | local-host | zero-cost-local | exact_request |
| openrouter | api-tools | no | no | api-key-scoped | key-limits-credits | aggregate |
| litellm | proxy-tools | callbacks | no | proxy-policy | budget-spend-tracking | derived |
| fleet | local-api | harness | no | tailscale-local | zero-cost-local | derived |

Signed-by: Quill Harper  
Team&Model: codex:gpt-5.4@local  
Role: collaborator
