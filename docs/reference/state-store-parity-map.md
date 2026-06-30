# State-store parity map (cross-runtime) — #1934

**Audit date:** 2026-06-30 · **Epic:** #3355 · **Machine-readable source of truth:** `inventory/orchestrator-governance-parity.json` → `stateStoreParity`.

Each orchestrator runtime stores governance state in a different home. The lease / lock / audit-log / per-session-state **primitives already exist** on `main`; this audit maps **where each runtime keeps each artifact** and is enforced by `scripts/global/state-store-parity-check.js` (wired into `npm run governance:orchestrator-parity`).

## Per-runtime state surface

| Runtime | Per-session state (`state_store.py`) | Status |
|---|---|---|
| **copilot** | `~/.copilot/hooks/state/repo-<hash>-<sid>.json` | full |
| **codex** | `~/.codex/devenv-ops/state/repo-<hash>-<sid>.json` | full |
| **antigravity** | `~/.gemini/antigravity/state/repo-<hash>-<sid>.json` | full |
| **claude-code** | — (no deployment target; `runtime_paths.py#state_root` has no claude branch) | **not-deployed** |
| **cursor** | — (Phase-2, #3086) | **not-deployed** |

## Shared cross-cutting paths (all runtimes write the same files)

| Artifact | Path | Primitive |
|---|---|---|
| Cross-team lease registry | `~/.megingjord/cross-team-leases.json` | `cross-team-lease-registry.js` (atomic via `atomic-json-store.js`) |
| Active-session lock | `~/.megingjord/active-session.lock` | `worktree-active-session-lock.js` (#1854) |
| Branch-ops audit log | `~/.megingjord/branch-ops-audit.log` | `hooks/scripts/branch-ops-audit.sh` |
| Authorization audit log | `~/.megingjord/authorization-audit.jsonl` | `scripts/global/authorization-audit.js` |

## Parity gaps (recorded, intentional)

- **claude-code** has no `state_store` deployment target — recorded, not a defect; the per-session state primitive is copilot/codex/antigravity only.
- **cursor** has no `state_store` deployment yet — tracked under Phase-2 (#3086).

## Enforcement

`state-store-parity-check.js` flags an **unmapped** runtime (a new runtime added to the manifest's `runtimes` list without a `stateStoreParity` entry) or a `full` runtime with no `statePath`. Intentional `not-deployed` runtimes are recorded and do **not** fail the audit, so a complete manifest keeps `governance:orchestrator-parity --strict` green. Coverage: `tests/orchestrator-governance-parity.spec.js` + `tests/stress-state-store-parity.spec.js`; self-test registry entry `state-store-parity`.
