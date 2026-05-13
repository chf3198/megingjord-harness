# Provider-Neutral Routing Boundary

## Ticket

- Issue: #1481 under Epic #1480.
- Scope: routing policy, provider adapter map, tests, and operator docs.
- Non-conflict: avoided merge-evidence work, dashboard panels, and active
  Claude/Copilot worktrees.

## Change

- Lanes now expose capability-tier names:
  - `free-auto`
  - `fleet-coding-local`
  - `balanced-cloud`
  - `frontier-reasoning`
- Provider-specific model IDs moved behind
  `scripts/global/routing-provider-adapters.json`.
- Anthropic remains the current default adapter for Haiku/Premium lanes, while
  OpenAI-compatible, OpenRouter, LiteLLM, Ollama, and fleet paths are explicit
  adapter options.

## Drift Review

drift_status: found

impacted_docs:
- `instructions/global-task-router.instructions.md`: lane names and provider
  boundary needed correction.
- `research/provider-neutral-routing-boundary-2026-05-13.md`: decision record
  needed for #1481.

not_applicable:
- Dashboard UX docs: no visual/dashboard behavior changed.
- Runtime deploy docs: no deployed runtime homes changed.
- Release notes: no release was cut in this ticket.

## Validation Plan

- JSON parse for routing policy files.
- Targeted Playwright tests for free router and fleet dispatch routing.
- `npm run lint`.
- `git diff --check`.

Signed-by: Quill Harper
Team&Model: codex:gpt-5.4@codex-cli
Role: collaborator
