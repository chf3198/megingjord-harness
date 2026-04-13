---
name: Ticket-Driven Work Management
description: Every task is tracked by a GitHub issue. Manager creates tickets before work begins. All changes link to tickets.
applyTo: "**"
---

# Ticket-Driven Work Management

**Requirement**: Every piece of work must have a GitHub issue ticket.

## Ticket Types

| Type | Purpose | Example | Estimate |
|---|---|---|---|
| **Epic** | Major feature or initiative | "Global task router" | Story points |
| **Story** | User-facing feature | "Add router lane visualization to dashboard" | 5–13 pts |
| **Task** | Internal/technical work | "Refactor router module to export classifyPrompt" | 2–8 pts |
| **Bug** | Defect fix | "Router misclassifies edge prompts" | 3–5 pts |
| **Doc** | Documentation | "Write README for router" | 2–3 pts |

## Labels (Scrum)

- `scrum:epic` — Epic
- `scrum:story` — Story
- `scrum:task` — Task
- `scrum:bug` — Bug
- `scrum:doc` — Documentation
- `status:backlog` — Not started
- `status:ready` — Ready to pull
- `status:in-progress` — Assigned and work begun
- `status:review` — PR open
- `status:done` — Merged/closed

## Manager Responsibilities

1. **Create tickets before work starts** — never code first.
2. **Validate ticket completeness** — title, description, type, labels, estimation.
3. **Link ticket to branch** — branch naming: `<issue>#<number>-<slug>`.
4. **Link ticket to PR** — PR body includes `Closes #N`.
5. **Enforce ticket closure** — close issue only after merge + validation.

## Linking Rules

- Branch: `#2-add-router-dashboard` or `#2-add-dashboard-panel`
- Commit: `git commit -m "feat(dashboard): add router panel (closes #2)"`
- PR: Body must include `Closes #2` + link to merge evidence

## Manager Automation

Manager CLI creates tickets with:
- Title, description, type
- Auto-assigned labels
- Story point estimation (prompt for user input)
- Link to related tickets (if any)
- Default milestone (current sprint or backlog)
