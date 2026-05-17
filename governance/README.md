# Cross-Team Governance Contract

Single canonical entry point for governance that spans Claude Code, Copilot, and Codex runtimes. The repo at `/home/curtisfranks/devenv-ops` is the development source of truth; deployed runtimes (`~/.copilot/`, `~/.codex/`, `~/.agents/skills/`) are never edited directly.

## Canonical layers

| Layer | Location | Purpose |
|---|---|---|
| Source-of-truth instructions | `instructions/*.md` | Runtime-agnostic governance contracts (30 files) |
| Schema layer | `inventory/governance-manifest.sample.json` | Machine-readable manifest with `bodyRef → instructions/*.md` |
| Adapter emission | `scripts/global/governance-adapter-emit.js` | Emits per-target files into `generated/governance-adapters/` |
| Drift detection | `scripts/global/governance-sync-check.js` | Fails CI when emitted artifacts diverge from canonical |
| Cross-team invariant lint | `scripts/global/cross-team-contract-check.js` | Verifies 4 invariants present in all 4 entry-point files |

## Entry-point files (per-runtime adapters)

| Runtime | File | Loaded by |
|---|---|---|
| Claude Code | `CLAUDE.md` | Claude Code memory at session start |
| Copilot | `.github/copilot-instructions.md` | VS Code Copilot custom instructions |
| Codex (project) | `.codex/AGENTS.md` | Codex project doc fallback |
| Generic / cross-tool | `AGENTS.md` | Cline, Continue, generic AGENTS.md readers |

Each entry-point file is short (≤100 lines) and references this contract. The substantive rules live in `instructions/*.md` and are loaded via `@instructions/...` imports.

## Four protected invariants (AC4)

All four entry-point files MUST mention each invariant. `cross-team-contract-check.js` verifies presence:

1. **Team&Model signing** — every governed artifact carries `Signed-by:` + `Team&Model:` + `Role:` per `instructions/team-model-signing.instructions.md`.
2. **Baton order** — Manager → Collaborator → Admin → Consultant single-thread per `instructions/role-baton-routing.instructions.md`.
3. **Ticket-first workflow** — no governed work without a linked GitHub issue per `instructions/ticket-driven-work.instructions.md`.
4. **Dedicated-worktree protocol** — one live worktree per agent per `research/concurrent-agent-worktrees-2026-04-24.md`.

## Adapter pattern (per #1692 architecture decision)

When runtime A needs different behavior than B:

1. Shared contract lives in `instructions/*.md` (single source of truth).
2. Runtime-specific adapter is a `.codex/adapters/*.js` or equivalent shim.
3. Adapter respects shared schema; only adds runtime-specific interpretation.
4. Tests cover shared + adapted behavior.

See `instructions/canonical-governance-anti-duplication.instructions.md` for the full pattern.

## Drift prevention chain

```
manifest validate → adapter emit → sync check → cross-team contract check → soak-language guard
```

The final step (`soak-language-guard`, #1809) catches calendar-bound "N-day soak" prose in baton artifacts, PR bodies, and docs. Translation rubric: `docs/howto/soak-to-replay-translation.md`. Replay infrastructure lives at `scripts/global/soak-replay-runner.js` per closed Epic #1771.

CI commands (all should pass on every governance-area PR):

```bash
npm run governance:manifest:validate    # schema validation
npm run governance:adapters:emit        # regenerate adapters
npm run governance:sync-check           # detect stale generated/
npm run governance:cross-team-check     # verify 4 invariants present
```

## Adding a new runtime adapter

1. Add target string to `targets` array in `governance-adapter-emit.js`.
2. Implement `targetPath()` branch returning the runtime's native file path.
3. Add the corresponding entry-point file at the root (referencing this contract).
4. Update `cross-team-contract-check.js` `ENTRY_POINTS` constant.
5. Add tests covering the new adapter path.
6. Wire only the lifecycle events the runtime natively emits — see the per-runtime event matrix in `instructions/canonical-governance-anti-duplication.instructions.md`.

## Related research

- Architecture decision: `#1692` (closed) — Canonical Governance Graph + Adapter Emitters + Drift Gates.
- Inventory + contradiction analysis: `research/cross-team-governance-inventory-2026-05-17.md`.
- Anti-duplication contract: `instructions/canonical-governance-anti-duplication.instructions.md`.
- Provider-neutral governance: `instructions/provider-neutral-governance.instructions.md`.
