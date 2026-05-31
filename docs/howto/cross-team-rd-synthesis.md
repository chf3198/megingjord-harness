# Cross-team R&D synthesis — operator howto

Coordinate a research question across multiple AI runtimes (Claude Code, Codex, Copilot, Antigravity, Gemini) on a single Epic, producing per-team perspectives that converge into a unified synthesis.

## Recommended flow (post Epic #2486): /xteam slash command

After installing the megingjord-xteam-mcp server in each runtime (see [xteam-mcp-install.md](xteam-mcp-install.md)), kicking off a synthesis takes ~30 seconds.

### Existing Epic

In any team's chat, type:

```
/xteam <epic-N>
```

Response: the server claims a role (LEAD if first; PARTICIPANT otherwise) and returns the tailored prompt for that team's perspective. Repeat in 3 more team chats — each gets a different role + prompt automatically.

### Brand-new question (no Epic yet)

```
/xteam-create <description text, 10+ chars>
```

The first team to invoke creates the Epic + research child + becomes LEAD. Subsequent teams discover the Epic + become PARTICIPANT.

### Check progress

```
/xteam-status <epic-N>
```

Returns `{ticket, leadTeam, status}`.

## How it works

```
Each /xteam invocation in a team session:

  1. MCP server reads team identity from MEGINGJORD_XTEAM_TEAM env
  2. Server calls gh CLI to atomic-claim leader label on the Epic
  3. First claim wins LEAD; later claims yield PARTICIPANT
  4. Server returns tailored prompt to the chat
  5. Team agent reads prompt + works in its own context
  6. Each team writes findings to artifacts/<team>-rd.md
```

Leader election is GitHub-label-based: `xteam-lead:<team>` on the Epic, with alphabetical tiebreaker on sub-1-second races.

## Per-team perspective lens

| Team | Lens |
|---|---|
| claude-code | Reasoning depth + multi-file refactor consequences |
| codex | OpenAI-ecosystem compatibility + CLI ergonomics |
| copilot | VS Code + GitHub-native developer experience |
| antigravity | Gemini long-context + Google Cloud integrations |

Source: `inventory/team-perspectives.json` (extend as new runtimes join).

## Convergence

Each team writes to `artifacts/<team>-rd.md` independently. The LEAD team is responsible for the final synthesis after all teams complete (per Epic #1112 protocol v3).

## Fallback: manual process (legacy)

If the MCP server is unavailable (Phase-1 not deployed yet, or runtime mismatch), the original manual process still works:

```bash
npm run synthesis:init -- --epic <N>
# generates planning/synthesis-<N>/*.md prompt files
# copy each into the right team chat manually
```

This path is preserved for resilience but is no longer the recommended flow.

## Related

- Epic #2486 (xteam MCP slash-command surface, Phase-1 shipped)
- Epic #1112 (cross-team R&D protocol v3 — the underlying mechanism)
- docs/howto/xteam-mcp-install.md (per-runtime install)
- research/xteam-mcp-design-2026-05-31.md (Phase-0 design rationale)
