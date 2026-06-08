# Workflow Learnings

## 2026-06-02
- #2617: Make overlap boundaries explicit at manager handoff (`related_tickets`, `overlap_decision`) so conflict prevention is enforced by schema, not operator memory.
- #2626: Direct fleet model calls without bounded timeout can stall sessions; use guarded wrappers or explicit timeout flags.

## 2026-06-07
- #2569: Don't ask the client for a credential already in the approved local `.env`. Before any credential prompt, call `credential-availability.js#preCredentialPromptCheck([names])` — `use-local` if available, else `report-absent-no-prompt` (report + terminal-entry, never request the raw secret in chat). Builds on #2645's `loadLocalEnv`.

## 2026-06-08
- #2730: Multi-close batch contract is for INSEPARABLE single-diff work only. If each AC has its own file(s), logic, and tests, it is separable and requires per-ticket workflow (dedicated worktree + branch + baton + own PR per ticket). Using batch as a convenience shortcut is a G1 violation. Pattern: `batch-shortcut-bypasses-per-ticket-workflow`.
- #2735: Six doc-coverage bugs shipped silently because the gate was advisory: `loadNaReasons()` must throw (not return null) on bad config; `execSync` with template strings is OWASP A03 injection — use `spawnSync` + args array; `severity:'warning'` violations don't block `ok:false` — promote to `'error'`; `DOC_COVERAGE_GATE_ADVISORY` env bypass must be removed from all callers, not just the validator itself.
- #2726/#2737: Pretool hook reads `~/.copilot/hooks/state/` (not `~/.megingjord/state/`). After a GraphQL merge (bypassing `gh pr merge`), hook state `admin_ops.merge` stays False. Record it manually via `load_state`/`save_state` from the correct `hooks/scripts/state_store.py` before attempting issue close.
- #2726: Baton CI gate `evidence-completeness` checks issue comment timestamps vs PR creation time. If MANAGER_HANDOFF or COLLABORATOR_HANDOFF is posted AFTER the PR is created, the gate fails with "retroactive planting" error. Post ALL baton artifacts before `gh pr create`.
- #2697: Fleet calls that lack a bounded timeout can stall the full session indefinitely. Always wrap fleet dispatches with an explicit `timeout` option or use the fleet-call-guard bounded wrapper.
