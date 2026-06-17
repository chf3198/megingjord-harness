# Design — standing sandbox worktrees + selective artifact provisioning (#3088, Epic #3083)

Goal: define how dedicated-IDE runtimes (Cursor, Antigravity) get a governed home, and which
gitignored artifacts the harness provisions into ANY worktree — closing the worktree-.env gap.
Harness goal order: Governance, Quality, Zero-Cost, Privacy, Portability, Resilience, Throughput,
Observability, Interoperability, Maintainability.

## D1 — Standing-worktree model for dedicated-IDE runtimes

VS Code teams (Claude Code, Copilot, Codex) share one IDE on `main` and isolate concurrent work
in EPHEMERAL per-ticket worktrees. Cursor and Antigravity each run a separate IDE process with a
PERSISTENT open workspace, so they get a STANDING worktree instead:

- One long-lived worktree per dedicated-IDE runtime, opened as that IDE's workspace root.
- Created once per machine by a harness command (`npm run runtime:worktree -- <runtime>`, wrapping
  `git worktree add`); refreshed by `git -C <wt> fetch && merge --ff-only origin/main` on session
  start; NEVER auto-removed.
- Ticket work still happens on `<type>/<issue>-<slug>` branches inside the standing worktree
  (the worktree is the IDE home, not a per-ticket throwaway). It is kept off `main`.
- The VS Code ephemeral per-ticket pattern is unchanged.

## D2 — Worktree location (client deferred the choice here)

RECOMMEND sibling dirs: `${HOME}/devenv-ops-cursor`, `${HOME}/devenv-ops-antigravity`.
- A sibling dir is a clean, self-contained workspace root for a separate IDE; a nested
  `.harness/worktrees/cursor/` makes the IDE index/confuse the parent repo and complicates
  ignore rules. Consistent with the existing `devenv-ops-<ticket>` sibling pattern.
- Action: amend ADR-012 (which currently specifies the nested path) to the sibling form for
  STANDING runtime worktrees, while ephemeral per-ticket worktrees keep their existing convention.

## D3 — Per-artifact provisioning policy (the core deliverable)

The harness must NOT blanket-install every gitignored artifact into every worktree. Each class
has a rule:

| Artifact (gitignored) | Class | Rule for a worktree |
|---|---|---|
| `node_modules/` | shared, large, deterministic | symlink from main (existing `worktree-session-start.sh`) |
| `.env` / provider secrets | shared, sensitive | **symlink from main** (same machine + operator; never copy → no drift/leak). Fallback: export `MEGINGJORD_DOTENV_PATH=<main>/.env` for runtimes that cannot follow symlinks |
| `.dashboard/`, `logs/`, `generated/`, `.cache/`, `tmp/`, `.log4brains/` | per-workspace ephemeral | LOCAL — not propagated; each worktree regenerates its own |
| hook state (`state/`, `*-nosession.json`) | per-workspace runtime state | per-worktree (state_store already keys by cwd) |
| git hooks / config | shared | inherited automatically via the git worktree's resolved `.git` |

Secrets nuance (G4): symlinking `.env` into a same-machine, same-operator sibling worktree does
NOT widen the trust boundary (the file is already local + gitignored) and is strictly safer than
copying (single source of truth, no stale duplicate). The credential-prompt-guard / log-redaction
contracts are about never EXPOSING secrets in chat/logs/commits — a local symlink is orthogonal.

## D4 — Harness init / worktree-provisioning policy

- A declarative manifest (`config/worktree-provisioning.json`) lists each gitignored path's class
  (`shared-symlink` | `local-ephemeral` | `per-worktree-state`), so the policy is auditable (G8)
  and settings-driven (G5), not hard-coded.
- `worktree-session-start.sh` (and the new `runtime:worktree` command) consume the manifest: link
  the `shared-symlink` set (node_modules, .env), leave `local-ephemeral` alone. This closes the
  worktree-.env `no_key` gap as first-class behavior for ALL worktrees (VS Code ephemeral + the
  dedicated-IDE standing worktrees alike).
- Init in a fresh workspace installs only what the manifest marks shared; per-workspace ephemera
  are created lazily by the tools that own them.

## D5 — Isolation between standing runtime worktrees (round-1 consensus add)

Cursor and Antigravity each get their OWN sibling worktree, so there is no filesystem collision.
Beyond the FS: each standing worktree is independently governed — its own branch, its own
per-cwd hook state (`state_store` keys by cwd), and its own `HAMR_TEAM` (`cursor` vs `antigravity`)
exported in that worktree's session env. The only SHARED resources are read-mostly and single-source
(the symlinked `node_modules` and `.env` point at main; neither runtime mutates them). No two
runtimes share mutable governance state, so concurrent Cursor + Antigravity sessions cannot
corrupt each other — the same single-writer guarantee the VS Code ephemeral worktrees already rely on.

## D6 — Default policy for UNCLASSIFIED artifacts (fail-safe, round-1 consensus add)

A gitignored path not listed in `config/worktree-provisioning.json` defaults to `local-ephemeral`
— it is NEVER auto-shared. A path must be EXPLICITLY marked `shared-symlink` to propagate from main.
Rationale (G4): a newly-introduced gitignored path is more likely to be a new secret/credential
store than a benign cache; defaulting unknown paths to "not shared" fails safe against leaking a
new secret into runtime worktrees. The provisioning script logs (G8) any unclassified gitignored
path it skipped, so the manifest is kept current deliberately rather than by silent drift.

## Implementation plan (what #3085 then builds on)

1. `config/worktree-provisioning.json` + a small `scripts/global/worktree-provision.js` that applies
   it (symlink shared set, idempotent, dry-run-able).
2. Extend `worktree-session-start.sh` to call it (adds `.env` symlink alongside the existing
   node_modules link).
3. `npm run runtime:worktree -- <cursor|antigravity>` to create/refresh a standing sibling worktree.
4. Amend ADR-012 (D2) + fix the `agent-worktree.sh cursor` 3-arg mismatch (Cursor UAT note).
5. #3085 (Cursor hooks + HAMR) then wires HAMR sessionStart in the Cursor standing worktree, which
   now has `.env` provisioned — the `no_key` failure cannot recur.

## Risks / mitigations
- Symlinked `.env` followed into a committed file → leak. Mitigation: `.env` stays gitignored in
  every worktree (the symlink target is gitignored; the symlink itself matches the ignore pattern).
- Standing worktree drifts from main → stale governance. Mitigation: ff-merge-on-session-start +
  a staleness advisory (reuse the freshness check).
- A runtime that cannot follow symlinks → `MEGINGJORD_DOTENV_PATH` fallback (already supported by
  the dispatch shims).
