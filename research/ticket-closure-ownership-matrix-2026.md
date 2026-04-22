# Ticket Closure Ownership Matrix — 2026-04-21

| Topic | Current best-practice finding | Harness rule |
|---|---|---|
| Closed issue status | Terminal state; should not remain in active workflow lanes | Closed tickets never appear in Agent Baton |
| Execution owner on close | Active execution ownership should end at close | Remove `role:*` labels on close |
| Historical ownership after close | Keep history, not active execution ownership | Dashboard normalizes closed historical owner to Manager |
| Done criteria | Explicit Definition of Done gates completion | `status:done` is only valid during Consultant closeout before terminal close |

## Summary

Modern issue systems optimize around status history, automation, and clean terminal states rather than lingering execution ownership. GitHub Projects automates issue closure into `Done`, Agile Definition of Done treats completion as a checklist contract, and modern tools like Linear emphasize time-in-status and workflow analytics over keeping stale owners attached to completed work.

## Findings

1. GitHub Issues separates assignees/labels from closed state; closed issues are still historical records, not active workflow holders.
2. GitHub Projects built-in automations explicitly set project status to `Done` when issues are closed.
3. Agile Alliance Definition of Done frames `done` as an explicit contract/checklist, not merely "last executor still owns it."
4. Linear’s 2026 workflow features center on time-in-status, dashboards, and automations, reinforcing status analytics instead of lingering terminal-role ownership.
5. For a baton model, the safest rule is: execution ownership ends on close; any residual audit ownership displayed after close should resolve to the process owner, not the last executor.

## Recommended valid matrix

| State | Active role | Allowed work types |
|---|---|---|
| `backlog` | none | all types before claim |
| `todo` | manager | all types during scoping |
| `in-progress` | collaborator | research, dev, UX, styling, graphics, docs, bug, infra, marketing |
| `ready-for-testing` | admin | dev, UX, styling, graphics, docs, bug, infra, marketing |
| `testing` | admin | dev, bug, infra |
| `passed-testing` | admin | dev, bug, infra |
| `done` (open) | consultant | any ticket finishing closeout |
| `closed` (GitHub) | none on issue labels; Manager in dashboard history | terminal only |
| `cancelled` | none | terminal only |

## Forbidden combinations

- Closed issue with any execution `role:*` label
- `status:backlog` plus any `role:*`
- `status:todo` with non-manager role
- `status:testing` or `status:passed-testing` with collaborator/consultant role
- `status:done` without Consultant closeout evidence
- Closed issue shown as Admin/Consultant in active baton UI

## Sources

- GitHub Docs — Assigning issues and pull requests: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/assigning-issues-and-pull-requests-to-other-github-users
- GitHub Docs — Projects built-in automations: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations
- Agile Alliance — Definition of Done: https://www.agilealliance.org/glossary/definition-of-done/
- Linear changelog — Time in status / workflow analytics: https://linear.app/changelog/2026-01-29-time-in-status
- Linear changelog — Agent and workflow automations: https://linear.app/changelog/2026-03-24-introducing-linear-agent

## Actionable next steps

1. Keep stripping execution role labels on close.
2. Audit closed issues periodically for stale nonterminal labels.
3. Add CI/label-lint for closed issue role/status drift if not already active.
4. Treat Manager as the only historical owner shown after terminal close in dashboard views.
