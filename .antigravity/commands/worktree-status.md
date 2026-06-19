---
name: "worktree-status"
description: "Show active, stale, and rescue-needed git worktrees."
argument-hint: ""
---

# Worktree Status

Invoke this command to list all git worktrees associated with the Megingjord Harness.

## Dispatch

```bash
node scripts/global/worktree-inventory.js
```

## Output

Prints a list of worktrees with their status:
- `active`: Current session or sandbox worktree
- `stale-risky`: Leftover worktree from completed/inactive ticket
- `rescue-needed`: Worktree requires administrative cleanup

## Cleanup

To remove a stale worktree:
```bash
git worktree remove --force <path>
git worktree prune
```
