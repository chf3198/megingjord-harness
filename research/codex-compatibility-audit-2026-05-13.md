# Codex Compatibility Audit

**Ticket**: #1476  
**Date**: 2026-05-13  
**Scope**: Harness goals, features, functionality, and OpenAI Codex fit.
## Executive Summary

The harness is not fundamentally Anthropic-locked. Codex already has a runtime
asset tree, hook deployment, OpenAI Developer Docs MCP wiring, Team&Model
signing, worktree guidance, and wiki coverage. The risk is policy drift: shared
routing, cost, activation, and IDE-proxy surfaces still present Claude/Anthropic
choices as defaults where the harness should separate runtime from provider.

The Codex priority is a provider-neutral hardening pass, not a rewrite.

## Official Codex Baseline

OpenAI Codex supports local CLI operation on Linux/macOS/Windows, IDE workflows,
cloud tasks, GitHub `@codex` delegation, PR workflows, `AGENTS.md`,
`config.toml`, MCP, hooks, skills, subagents, apps/connectors, sandbox and
approval controls, web search, and OpenTelemetry.

The migration guide maps Claude Code assets to Codex equivalents: instructions
to `AGENTS.md`, settings to `config.toml`, skills/hooks/MCP/slash commands to
Codex-native assets, and subagents to Codex agents. The harness should model
common capability contracts, then emit runtime-specific adapters.

## Scorecard

Strong: goals, worktrees, instructions, runtime deployment, wiki. Medium risk:
config, hooks, telemetry, IDE-proxy scoping. High risk: routing defaults and
HAMR activation defaults.

## Findings

1. **Routing defaults lean Anthropic.**
   `instructions/global-task-router.instructions.md`,
   `scripts/global/model-routing-policy.json`, and
   `scripts/global/free-router.js` use Claude model names as visible
   Haiku/Premium defaults. Provider IDs should move behind capability tiers.
2. **HAMR activation defaults to Claude Code.**
   `scripts/global/hamr-activate.sh` defaults `HAMR_TEAM` to `claude-code` and
   requires `ANTHROPIC_API_KEY`. Codex markers exist, but are opt-in.
3. **Codex runtime deployment is a strength.**
   `scripts/global/codex-runtime.js` deploys skills, scripts, hooks, rules,
   wiki files, `AGENTS.md`, runtime config, and hooks JSON into Codex paths.
4. **Codex config needs cleanup.**
   `.codex/config.toml` and `.codex/runtime.config.toml` load Codex project docs
   and OpenAI docs MCP, but duplicate fallback entries and minimal
   project-scoped guidance leave behavior implicit.
5. **AGENTS.md is underused for Codex review.**
   OpenAI docs state Codex searches for `AGENTS.md` and applies the closest
   instructions during review. The repo should add focused review rules for
   governance, signing, ticket lifecycle, and worktree failures.
6. **Provider-specific cost levers are blended with generic policy.**
   HAMR correctly distinguishes runtime from provider, but cache and batch
   examples remain Anthropic-heavy. OpenAI-compatible providers need parallel
   terminology for prompt caching, Batch API, aggregate usage exports, and
   OpenTelemetry.
7. **OpenAI usage and telemetry need a first-class path.**
   The harness warns against inventing unavailable per-request Codex token
   totals, which is correct, but it still needs an official aggregate usage and
   OpenTelemetry ingestion path.
8. **Claude-specific IDE proxy should stay scoped.**
   `instructions/ide-proxy.instructions.md` is a Claude Code shim. Keep it as
   an adapter, and document Codex IDE operation separately through native Codex
   CLI, IDE extension, cloud, and GitHub integration capabilities.

## Recommended Follow-Up Tickets

1. P1 provider-neutral routing policy: replace visible Claude-only lane names
   with capability tiers plus provider adapters.
2. P1 Codex config and AGENTS review hardening: add Codex-native review rules.
3. P2 HAMR activation parity: make team/runtime explicit, fix linked-worktree
   `.git` handling, and remove Anthropic key as a universal activation gate.
4. P2 OpenAI/Codex telemetry runbook: define aggregate usage and OpenTelemetry
   ingestion without fabricating unavailable per-call totals.
5. P3 provider adapter matrix: track Anthropic, OpenAI-compatible, OpenRouter,
   Ollama, LiteLLM, and fleet behavior under one portable capability contract.

## Non-Conflict
This ticket is docs/research/wiki only. It avoids active implementation owned by
the Claude Code Team on #1271 and Copilot Team on #1235. Follow-up tickets
should be independently scoped before any shared routing or HAMR edits.

## Sources

- <https://developers.openai.com/codex/quickstart>
- <https://developers.openai.com/codex/config-reference#configtoml>
- <https://developers.openai.com/codex/integrations/github#customize-what-codex-reviews>
- <https://developers.openai.com/codex/migrate>
- Local files audited: `.codex/AGENTS.md`, `.codex/config.toml`,
  `.codex/runtime.config.toml`, `scripts/global/codex-runtime.js`,
  `scripts/global/hamr-activate.sh`, `scripts/global/hamr-sync-verify.js`,
  `instructions/hamr-routing.instructions.md`, global task routing, IDE proxy,
  and `inventory/team-model-signatures.json`.

Signed-by: Quill Harper  
Team&Model: codex:gpt-5.4@codex-cli  
Role: collaborator
