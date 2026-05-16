# scripts/global/*.js gh-CLI → MCP migration audit (#1641)

Inventory of direct `gh` CLI / REST calls in `scripts/global/*.js` and
MCP-tool equivalents. Per #1641 AC1-AC4. Sourced from #1629 contract.

## Callers found (8 files)

| File | Calls | MCP-tool equivalent | Migration value |
|---|---|---|---|
| `anneal-tier2-autofile.js` | `gh issue create`, `gh issue comment` | `mcp__github__create_issue`, `mcp__github__create_issue_comment` | **High** — frequent path; benefits from schema validation |
| `closeout-preflight.js` | `gh issue view --json`, `gh pr view --json` | `mcp__github__get_issue`, `mcp__github__get_pull_request` | **High** — runs on every push; performance + schema |
| `cross-team-conflict-gate.js` | `gh pr list --json` | `mcp__github__list_pull_requests` | Medium — runs on PR open only |
| `dep-graph-aggregate.js` | `gh issue list --json` | `mcp__github__list_issues` | Medium — runs on schedule |
| `epic-evidence.js` | `gh issue view --json`, `gh issue comment` | `mcp__github__get_issue`, `mcp__github__create_issue_comment` | Medium — runs at Epic close |
| `issue-transition.js` | `gh issue edit --add-label`, `gh issue edit --remove-label`, `gh issue close` | `mcp__github__update_issue` | **High** — runs on every baton transition |
| `anneal-schedule-health.js` | `gh issue list --json` | `mcp__github__list_issues` | Low — daily cron |
| `cross-team-lease.js` | `gh issue comment`, `gh issue view --json` | `mcp__github__create_issue_comment`, `mcp__github__get_issue` | **High** — claim flow |

## Categorization (AC2)

| MCP capability | Callers |
|---|---|
| Issues (read) | closeout-preflight, dep-graph-aggregate, epic-evidence, anneal-schedule-health, cross-team-lease |
| Issues (write — create) | anneal-tier2-autofile |
| Issue comments (write) | anneal-tier2-autofile, epic-evidence, cross-team-lease |
| Issue labels (write) | issue-transition |
| Pull requests (read) | closeout-preflight, cross-team-conflict-gate |
| Projects v2 | (none yet — surface untouched; future per #1630) |
| Sub-issues | (none yet — future per #1631) |
| Discussions | (none yet — future per #1633) |

## Migration value scoring (AC3)

Sorted by recommended migration order:

1. **`issue-transition.js`** — runs on every baton transition (dozens of calls per session). Schema-validation prevents typos like `lable` vs `label`. **High value**.
2. **`closeout-preflight.js`** — runs on every push. Schema-validation prevents the lane-hardcoded class of bugs caught by #1639. **High value**.
3. **`anneal-tier2-autofile.js`** — emits new issues; schema validation guards against malformed bodies. **High value**.
4. **`cross-team-lease.js`** — claim flow correctness matters. **High value**.
5. **`epic-evidence.js`** — Epic-close gate; lower frequency but high stakes. **Medium**.
6. **`cross-team-conflict-gate.js`** — runs on PR open only. **Medium**.
7. **`dep-graph-aggregate.js`** — scheduled cron. **Medium**.
8. **`anneal-schedule-health.js`** — daily cron, low stakes. **Low**.

## Output (AC4)

This file is the AC4 deliverable.

## Next steps (separate follow-ons, not in #1641 scope)

Per-helper migration tickets are NOT filed by this audit. Migration is opt-in
and incremental — each helper's owner team can prioritize. The audit gives
the prioritization framework; per-helper work tickets emerge when an owner
team chooses to migrate.

## Portability (per #1628 G5)

Migration is **opt-in via `MEGINGJORD_MCP_DISABLED=1`** per #1629 contract.
Each migrated helper must retain the `gh` CLI fallback path so air-gapped
operators or operators with the opt-out env var see no behavior change.

## Related

- #1641 — parent (this audit)
- #1629 — MCP server adoption (contract)
- #1628 — G5 Portability backing
- `docs/howto/mcp-server-adoption.md` — operator guide
