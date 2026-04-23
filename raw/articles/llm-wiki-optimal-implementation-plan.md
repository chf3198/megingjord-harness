the compaction anchor. This surfaces missed ingest opportunities.
tool_activity state), emit a reminder: "WIKI PENDING: log this session's
# LLM Wiki Optimal Implementation Plan — Research Synthesis

Date: 2026-04-23

## Summary

This plan aligns DevEnv Ops wiki operations to 2025–2026 agent-harness best
practices: context engineering (Karpathy/Lutke), deterministic hook enforcement
(Anthropic), and long-term memory patterns (Mem0 + Weng taxonomy).

## Key Findings

1. **Context engineering is primary**: wiki pages are context fuel, not static docs.
2. **Hooks beat instructions for reliability**: deterministic reminders should run in
   SessionStart/PreCompact/Stop.
3. **Current architecture is sound but narrow**: `wiki_wisdom.py` already injects wiki
   guidance, but only a few pages are actively routed.
4. **Main utilization gap**: post-work wiki ingest is often skipped.

## Architecture Snapshot

| Layer | Current state | Gap |
|---|---|---|
| Session context | Injects governance + baton wiki snippets | Needs task-adaptive page routing |
| Long-term memory | wiki/index.md + wiki/log.md + page graph | Ingest discipline inconsistent |
| Reflection | syntheses pages exist | Under-produced |

## Implementation Tiers

### P0 (Immediate)

- Add task-adaptive SessionStart wiki routing.
- Inject "wiki pattern" reminder in devenv-ops sessions.
- Add Stop hook wiki-pending reminder after significant work.

### P1 (Near-term)

- Preserve wiki reminder in PreCompact anchor.
- Add mandatory "Wiki Updates Pending" section in handoff docs.
- Expand routing to dashboard/ticket lifecycle syntheses and concepts.

### P2 (Advanced)

- Build prompt-keyword `wiki_router.py` for top-3 page routing.
- Trigger synthesis suggestion when multiple concepts are exercised.
- Auto-regenerate index catalog during wiki anneal/lint.

## Priority Matrix

| Priority | Action | Impact |
|---|---|---|
| P0 | SessionStart routing + Stop reminder | High |
| P1 | PreCompact + handoff wiki section | High |
| P2 | Full keyword router + synthesis trigger | Medium/High |

## Guardrails

- Do not add vector DB/RAG at current wiki scale.
- Do not force blocking wiki writes mid-task.
- Keep CLAUDE/instructions concise; store knowledge in wiki pages.
- Maintain curated wiki entries, not raw session dumps.

## Sources

- Anthropic: Building effective agents; Claude Code best practices
- Mem0: April 2026 memory algorithm and benchmark notes
- Lilian Weng: LLM-powered autonomous agents taxonomy
- Karpathy/Lutke: context engineering framing
