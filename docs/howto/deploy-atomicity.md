# Deploy atomicity — per-runtime rollback markers (#1935)

**Epic:** #3355 · **Module:** `scripts/global/deploy-atomic.js` · **Entry:** `npm run deploy:atomic`

## The gap (before)
`scripts/deploy.sh` deploys runtimes sequentially under `set -euo pipefail`, backs up **only Copilot**, and writes no audit log. A partial failure (`codex` deploys, `copilot` fails) leaves the runtime homes inconsistent with no recovery beyond manual `git revert`.

## Design decision: per-runtime rollback markers (not a distributed 2-phase commit)
Runtime homes (`~/.copilot`, `~/.codex`, `~/.claude`, `~/.antigravity`, `~/.cursor`) are independent directories on one filesystem. A true cross-filesystem 2-phase commit is over-engineering (G10) and brittle. Instead, the transaction wrapper:

1. **Backs up** each runtime home before overwrite (`<home>-deploy-backup-<ts>`).
2. **Deploys** that runtime (composing the existing `scripts/deploy.sh --target <rt> --apply` — it does **not** rewrite the deploy logic, G10).
3. On per-runtime failure, **restores** that runtime's backup and appends a `rollback` marker.
4. Emits one **schema-v3** row per runtime to `~/.megingjord/deploy-audit.jsonl` (`{ts, version:3, service, event, runtime, result, backup_path, sha}`), routed through `log-redaction.js` (G4).

## Two modes
| Mode | Trigger | Partial-failure behavior |
|---|---|---|
| **Per-runtime** (default) | `DEPLOY_ATOMIC` unset | Restore only the failed runtime; continue others. Adds backup + audit to today's behavior. |
| **All-or-none** (atomic) | `DEPLOY_ATOMIC=1` | A partial failure restores **every** already-succeeded runtime and aborts. |

All-or-none ships behind the env flag (advisory-first) until soak-clean; unsetting `DEPLOY_ATOMIC` reverts to exactly today's sequential behavior. The markers + backups **are** the rollback mechanism, so `git revert` is only needed for the code, not the deployed state.

## Tests
`tests/deploy-atomicity.spec.js` (all-3-success, partial→rollback SHA/content match, total→full-restore over a fake `$HOME`) + `tests/stress-deploy-atomicity.spec.js` (G6: concurrent markers never corrupt the JSONL + chaos restore; G7: marker p99 < 50ms).
