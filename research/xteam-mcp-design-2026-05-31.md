---
title: "/xteam MCP slash-command surface — Phase-0 design (Epic #2486)"
date: 2026-05-31
epic: 2486
ticket: 2487
lane: docs-research
test_strategy: peer-review
status: draft
---

# /xteam MCP slash-command surface — Phase-0 design

Phase-0 research synthesis for Epic #2486. Designs a portable MCP server that exposes `/xteam` slash commands consumable by Claude Code, Codex, Copilot, and Antigravity — replacing the 5-step manual kickoff documented in `docs/howto/cross-team-rd-synthesis.md`.

## Problem

Current synthesis kickoff (per Epic #1112 ship + #2485 follow-on):
1. Client opens terminal, runs `npm run synthesis:init -- --epic <N>`
2. Finds 4 generated prompt files under `planning/synthesis-<N>/`
3. Copies contents of each file
4. Pastes into each of 4 team chat sessions
5. Monitors progress via `npm run synthesis:status`

This puts terminal + filesystem burden on the client (chf3198 = Client role, not Operator). Violates the harness contract that the client is design + UAT only.

## Solution overview

```
┌──────────────────────────────────────────────────────────────────┐
│  Build ONE MCP server (megingjord-xteam-mcp)                     │
│  Register it ONCE per runtime (5-minute setup, documented per    │
│  runtime).                                                       │
│                                                                  │
│  After registration, EVERY team sees the same slash-commands:    │
│    /xteam <epic-N>        — join synthesis on existing Epic      │
│    /xteam ? <description> — create Epic + kick off synthesis     │
│    /xteam-status <N>      — query progress                       │
│                                                                  │
│  First team to invoke claims LEAD; others become NON-LEAD.       │
│  Each team sees a tailored prompt for its role + perspective.    │
└──────────────────────────────────────────────────────────────────┘
```

## AC2: MCP prompts cross-runtime registration

Per 2026 MCP roadmap (blog.modelcontextprotocol.io/posts/2026-mcp-roadmap), MCP `prompts` surface natively as slash commands in every MCP-compatible client. Registration command per runtime:

| Runtime | Install command | Friction | Config location |
|---|---|---|---|
| Claude Code | `claude mcp add megingjord-xteam` | Low (CLI flag) | `~/.claude/mcp_config.json` |
| Codex CLI | `codex mcp add megingjord-xteam` | Low (CLI flag) | `~/.codex/mcp_config.json` |
| VS Code Copilot | Settings UI: Add MCP Server (or `chat.mcp.discovery.enabled: true` auto-imports from Claude Desktop) | Medium (UI clicks; auto-discovery helps) | `.vscode/mcp.json` or workspace settings |
| Antigravity | Agent pane > MCP Servers > Install | Medium (UI clicks) | Antigravity-specific UI |
| Gemini CLI | Edit `~/.gemini/settings.json` | Higher (manual JSON edit; no CLI helper) | Single shared file |

**Honest portability note**: Gemini CLI has higher install friction than the other runtimes — manual JSON edit, no CLI installer. Phase-1 should ship an `install-xteam.sh` wrapper that automates the JSON edit for parity.

One-time setup per runtime, then `/xteam` works identically in all.

## AC3: Leader-election protocol

Three candidate primitives evaluated. Recommended: **GitHub-label-based** (Tier 1, per #2479). HAMR merge-claim (#2458) remains available as Tier-2 fallback.

### Recommended: GitHub label atomic acquire

Uses #2479 GitHub-label-based primitive (atomic label-set semantics: first writer wins, later writers see existing label and yield to participant role).

Concrete API-call sequence is Phase-1 implementation detail (see Open questions §"Concrete acquire sequence").

### Tiebreaker for true-simultaneity (<1 second apart)

If two teams race within sub-1-second:
- Both succeed at label-add (GitHub permits multiple labels)
- Tiebreaker: lowest team-name alphabetical OR earliest "labeled_at" timestamp from GitHub events API
- Loser removes its xteam-lead label, takes participant role

### G6 fallback when GitHub unreachable

If `gh` CLI fails: MCP server returns advisory message "GitHub unreachable; cannot claim role. Try again or use HAMR opt-in via MEGINGJORD_XTEAM_HAMR=1". No fake-claim; G6 graceful degradation.

## AC4: Per-team perspective-tailoring

Each team gets a DIFFERENT prompt for the same `/xteam` invocation, tailored to that team's perspective:

```
┌────────────────────────────────────────────────────────────────┐
│ Lead team prompt:                                              │
│   - "You are LEAD. Create the Epic if absent; otherwise        │
│     coordinate synthesis"                                      │
│   - "Your perspective: <team-specific lens>"                   │
│   - "Synthesize all team artifacts at convergence"             │
│                                                                │
│ Non-Lead team prompt:                                          │
│   - "You are PARTICIPANT. Lead is <lead-team>"                 │
│   - "Your perspective: <team-specific lens>"                   │
│   - "Write your findings to artifacts/<team>-rd.md"            │
└────────────────────────────────────────────────────────────────┘
```

### Per-team perspective lens

| Team | Lens (always-applied) |
|---|---|
| Claude Code | Reasoning depth + multi-file refactor consequences |
| Codex | OpenAI-ecosystem compatibility + CLI ergonomics |
| Copilot | VS Code + GitHub-native developer experience |
| Antigravity | Gemini long-context + Google Cloud integrations |

Perspective text comes from `inventory/team-perspectives.json` (new file to be authored Phase-1).

## AC5: 3-tier adjacency map

| Epic / Ticket | Relation |
|---|---|
| Epic #1112 | Provides the underlying cross-team R&D protocol (v3) that /xteam invokes |
| #2485 | First real synthesis run (target Epic #2398); will benefit immediately from /xteam |
| #2479 | GitHub-label-based merge-claim — provides the atomic primitive for leader election |
| Epic #2488 + #2489 | HAMR Layer 2 GitHub-native replacement; mailbox primitive reused by /xteam |
| HAMR merge-claim (#2458) | Tier-2 opt-in primitive if GitHub-label approach insufficient |

## Privacy considerations (G4)

GitHub-label-based leader-election surfaces minimal information at the API layer:

- **No PII in command args**: `/xteam <epic-N>` and `/xteam ? <description>` carry only Epic numbers and free-text description; no user credentials, no model state, no working-tree paths.
- **GitHub token scope**: each runtime's `gh` CLI uses its own user PAT/OAuth token; the MCP server does NOT collect or store tokens. Tokens stay in the runtime's credential store.
- **Label exposure**: `xteam-lead:<team>` labels are visible to anyone with read access to the Epic — which is the same audience that sees the Epic body anyway. No new exposure surface.
- **Description text**: `/xteam ? <description>` writes the description into the Epic body. Operators MUST NOT include secrets or PII in the description. Phase-1 should add a secret-scanner pre-check.

## Observability (G8)

Every `/xteam` invocation emits one event to `~/.megingjord/baton-events.jsonl` per Epic #2451 Move 2 schema v3:

```jsonl
{"ts":"...","version":3,"service":"xteam","event":"invocation",
 "team":"claude-code","ticket":2486,"role":"lead|participant",
 "decision":"epic-created|epic-joined|status-query",
 "duration_ms":<n>,"session_id":"..."}
```

This enables:
- Dashboard panel: live view of in-flight xteam sessions across teams (Epic #2451 Move 2 dashboard already shipped)
- Post-hoc audit: which team became LEAD on Epic #N, when, why
- Trend analysis: convergence-time per Epic, role-distribution fairness
- PII redaction at instrumentation site: description text passes through `redact()` per #2457 contract before logging

Observability is NOT optional in this design — every invocation logs, regardless of feature flag. Operators cannot disable logging without disabling the MCP server entirely.

## Open questions for Phase-1

0. Concrete acquire sequence (moved here per iter-1 Q6 scope-creep tighten): exact `gh issue edit` command, retry-on-race semantics, label namespace (`xteam-lead:<team>` vs alt schemas).

1. Should `/xteam ? <description>` Epic-creation use a fixed lane (e.g., `lane:docs-research`) or infer from description?
2. Should the MCP server respect workspace overrides (e.g., a workspace declares `xteam-tier: 2` for cross-workspace mode)?
3. How to handle re-entry: if a team is already LEAD on Epic 999 and re-invokes `/xteam 999`, should it re-emit its prompt or no-op?
4. Should the MCP server be distributed via npm, PyPI, or both? (Per global-install pattern, likely both.)
5. What is the MCP server signature/auth contract — DPoP + Ed25519 (A2A-aligned), or simpler GitHub-token-passthrough?

## Honest scope guard

This Phase-0 design assumes Tier 1 only (single-workspace, multi-AI-team coordination). Tier 2/3 cross-workspace coordination is explicitly out of scope per Epic #2488 Tier-1-only scoping. Tier-2/3 tracking at #2490.

## Sources

- [The 2026 MCP Roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [Model Context Protocol Complete Guide 2026 (SurePrompts)](https://sureprompts.com/blog/model-context-protocol-mcp-complete-guide-2026)
- [Agent2Agent (A2A) Protocol Specification](https://a2a-protocol.org/latest/)
- [Add and manage MCP servers in VS Code](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
- [Google Antigravity Tutorial (AyyazTech)](https://ayyaztech.com/blog/google-antigravity-free-claude-gemini-3-ide-tutorial)
- [Vercel MCP server docs](https://vercel.com/docs/agent-resources/vercel-mcp)
- [GitHub IssueOps Pattern (GitHub Blog)](https://github.blog/engineering/issueops-automate-ci-cd-and-more-with-github-issues-and-actions/)
- [MCP Cheat Sheet 2026 (Webfuse)](https://www.webfuse.com/mcp-cheat-sheet)
