---
title: Baton Workflow Enforcement Hardening
created: 2026-04-15
ticket: "#104"
epic: "#101"
status: complete
---

# Baton Workflow Enforcement Research

## Root Cause: Why #102/#103 Skipped the Baton

1. **repo-scope disabled**: `enabled=false` in `repo-scope.json`
   — both `commit_ticket_gate.py` and `manager_ticket_gate.py` silently skip
2. **Orphaned hooks**: Gate scripts exist but aren't wired into `global-standards.json`
3. **No Manager-phase gate**: `manager_handoff` boolean tracked but never read as a gate
4. **PreToolUse only gates terminal**: File-edit tools (`create_file`, etc.) ungated
5. **PostToolUse is advisory**: Flags set after-the-fact, never block

## Current Hard Gates vs. Gaps

| Phase | Enforcement | Type |
|-------|------------|------|
| Admin (commit→push→merge) | Full sequencing | **DENY** |
| Dangerous commands | Blocked | **DENY** |
| Stop (uncommitted changes) | Blocked | **BLOCK** |
| Manager scope definition | None | **GAP** |
| Baton event emission | None | **GAP** |
| File-edit without baton | None | **GAP** |

## Recommended 3-Tier Enforcement

### Tier 1 — Config only (P0, 0 new code)
- Enable `repo-scope.json`: set `enabled: true`
- Wire `commit_ticket_gate.py` + `manager_ticket_gate.py` into hooks

### Tier 2 — PreToolUse file-edit gate (P0, ~20 lines)
- Intercept `create_file`, `apply_patch`, `replace_string_in_file`
- If `manager_handoff=false` and target is code: emit `ask`/`deny`

### Tier 3 — Defense in depth (P1, ~20 lines)
- PostToolUse: baton-violation nag when `code_touched + !manager`
- Stop: role-completeness audit before session end

## Cost/Benefit Summary

| Mechanism | Complexity | Coverage | False-Pos |
|-----------|:--:|:--:|:--:|
| Wire orphaned hooks | 1 | 3 | 2 |
| PreToolUse file-edit gate | 2 | 5 | 3 |
| PostToolUse baton nag | 1 | 2 | 2 |
| Stop baton audit | 1 | 3 | 3 |

Tiers 1+2 catch ~85% of violations. Adding Tier 3 reaches ~95%.
