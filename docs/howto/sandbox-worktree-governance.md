# Sandbox Worktree Governance

Sandbox branches are launcher branches for agent sessions, not delivery branches.
Use ticket-linked feature, fix, or hotfix branches for implementation work.

## Launcher Branches

- `sandbox/copilot`
- `sandbox/codex`
- `sandbox/claude-code`

## Session Start

Before implementation, refresh the launcher and move to a ticket branch:

```bash
bash scripts/worktree-session-start.sh <copilot|codex|claude-code> feat/<issue#>-<slug>
```

## Audit Commands

Run the full fleet audit before releases or governance reviews:

```bash
npm run governance:worktrees
```

Run a target-specific audit when validating one runtime without being blocked by
another team's launcher freshness:

```bash
node scripts/global/worktree-governance-audit.js --target=codex --json
```

Valid targets are `copilot`, `codex`, and `claude-code`. The default audit still
checks every launcher branch and should remain the release-quality signal.

## Coordination View

Use the read-only coordination view before opening VS Code on a multi-team
workspace:

```bash
node scripts/global/cross-team-coordination-view.js --json
```

Write a static report for dashboard ingestion or review packets:

```bash
node scripts/global/cross-team-coordination-view.js --json --out .dashboard/cross-team-coordination.json
```

The report separates active leases, stale leases, conflicts, and cleanup
candidates. Treat active leases as owned by their ticket holder. Treat cleanup
candidates as plan-only until their owning ticket has merged and its lease is
closed.
