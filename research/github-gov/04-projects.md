# Projects v2 & Merge Queue

## Projects v2 Built-in Workflows

Default automations (enabled for new projects):
- **Item closed → Status: Done** (issues/PRs)
- **PR merged → Status: Done**

Configurable automations:
- Item added → set Status (e.g., "Todo")
- Item reopened → set Status (e.g., "In Progress")
- Auto-add items from repos matching filter criteria
- Auto-archive items matching criteria

## Custom Fields

Up to 50 fields per project (including built-in):
- **Text** — free-form notes
- **Number** — complexity scores, story points
- **Date** — target ship dates, deadlines
- **Single select** — priority, status enums
- **Iteration** — sprint/week planning with break support

## Views & Layouts

Three layouts: Table (spreadsheet), Board (kanban), Roadmap
(timeline). Filter, sort, group, slice by any field.

## Advanced Automation

Use Actions + GraphQL API for project operations:
- Trigger on `issues`, `pull_request` events
- GraphQL API updates project item fields
- Set status, priority, iteration programmatically
- Status updates: On Track, At Risk with dates
- Built-in Insights charts from project data

**Availability:** Projects v2 on ALL plans. No restrictions.

---

## Merge Queue

### Availability (Critical Limitation)

Only available in:
- Public repos owned by an **organization**
- Private repos on **Enterprise Cloud** orgs

**NOT available for personal repos (any plan).**

### How It Works

1. PR passes all branch protection checks
2. User adds PR to merge queue
3. Queue creates temporary branch with combined changes
4. CI runs against combined branch
5. On success, merge to target. On failure, remove + rebuild.

### Configuration

- Merge method: merge, rebase, squash
- Build concurrency: 1-100 concurrent CI builds
- Status check timeout, merge limits
- Must add `merge_group` event trigger in Actions

**devenv-ops impact:** LOW — personal repo cannot use this.
