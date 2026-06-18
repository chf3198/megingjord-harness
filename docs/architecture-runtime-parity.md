# Architecture — Multi-Runtime Parity

A core architectural goal is that Copilot, Claude Code, and Codex behave
identically for all governed operations. No runtime is second-class.

## Parity model

```
                ┌─────────────────────────────────────────────┐
                │           Governance Manifest               │
                │    inventory/governance-manifest.json       │
                └──────────────────┬──────────────────────────┘
                                   │
               ┌───────────────────┼───────────────────┐
               ▼                   ▼                   ▼
    ┌───────────────────┐ ┌────────────────┐ ┌──────────────────┐
    │  GitHub Copilot   │ │  Claude Code   │ │      Codex       │
    │ copilot-instr.md  │ │  CLAUDE.md     │ │  AGENTS.md       │
    │ ~/.copilot/       │ │  ~/.claude/    │ │  ~/.codex/       │
    └───────────────────┘ └────────────────┘ └──────────────────┘
```

## Adapter generation

`npm run governance:adapters:emit` reads `inventory/governance-manifest.json`
and emits runtime-specific shims for each engine:

| Output                            | Target runtime      | Mechanism              |
| --------------------------------- | ------------------- | ---------------------- |
| `.github/copilot-instructions.md` | GitHub Copilot Chat | Workspace instructions |
| `CLAUDE.md`                       | Claude Code         | Startup context file   |
| `AGENTS.md`                       | OpenAI Codex        | AGENTS.md protocol     |
| `generated/governance-adapters/`  | All (audit trail)   | Timestamped snapshots  |

Adapters are rebuilt on every governance manifest change. The
`orchestrator-governance-parity.json` registry tracks which features are active
per runtime and is checked by `quality-required` CI.

## Parity coverage matrix

| Feature               | Copilot          | Claude Code          | Codex                |
| --------------------- | ---------------- | -------------------- | -------------------- |
| Skills / capabilities | ✅ `plugin.json` | ✅ `.claude-plugin/` | ⚠️ `AGENTS.md` tools |
| Instructions          | ✅               | ✅                   | ✅                   |
| Hooks                 | ✅               | ✅                   | ✅                   |
| Baton governance      | ✅               | ✅                   | ✅                   |
| Wiki access           | ✅               | ✅                   | ✅                   |
| Layer-2 routing       | ✅               | ✅                   | ✅                   |

⚠️ = partial; Codex tool support depends on the OpenAI Codex API version in use.

**Cursor** is the 5th governed runtime (Epic #3083). Its full #1912 twelve-surface
parity matrix lives in [docs/howto/cursor-parity-matrix.md](howto/cursor-parity-matrix.md)
— all surfaces parity-complete or parity-via-shared-mechanism, no open waivers.

## Cross-runtime review discipline

When Copilot and Claude Code or Codex disagree on behaviour:

1. Consult the **official docs** for the uncertain runtime — never infer from another
2. File a parity issue with labels `type:bug,area:parity`
3. The adapter generator is the correct fix path; never patch one runtime's file manually

See `instructions/cross-family-review.instructions.md` for the full protocol.

## Runtime-specific notes

**GitHub Copilot Chat**: Skills route through `plugin.json`. New skills require
a plugin reload (`Chat: Refresh Skills`) after deploy. Universal skills affect
all consumers; personal skills deploy only to `~/.copilot/` on this machine.

**Claude Code**: Hooks in `~/.claude/hooks/` run as shell commands. Ensure
execute permissions on `.sh` files after deploy — `deploy:claude:apply` sets
these automatically. Agent definitions live in `~/.claude/agents/`.

**Codex**: Use official OpenAI Codex documentation for behaviour questions.
Do not infer from Copilot or Claude Code compatibility. Tool calls are declared
in `AGENTS.md § tools` using JSON Schema format. The `pre-task` and `post-task`
hook lifecycle differs from Claude Code's hook model.

## Adapter parity check

```bash
npm run governance:adapters:emit  # regenerate all adapters
git diff generated/               # inspect drift
```

Unexpected diff → file a parity ticket before merging the change.
