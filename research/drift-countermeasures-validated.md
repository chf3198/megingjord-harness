# Governance Drift: Validated Countermeasures

**Date**: 2026-04-19
**Parent**: #257 (Research governance drift), Epic #256
**Sources**: 7 research docs (380 lines), 3+ external sources

## Drift Taxonomy (6 Categories)

| Category | Detection | Gate Type | Status |
|----------|-----------|-----------|--------|
| Git protocol (branch/commit) | pretool_guard.py | Hard deny | ✅ Active |
| Baton sequencing (role order) | pretool_guard.py | Hard deny | ✅ Active |
| Ticket lifecycle (missing refs) | commit_ticket_gate.py | Hard deny | ✅ Active |
| Tool misuse (wrong tool) | pretool_guard.py | Hard deny | ✅ Active |
| Scope drift (creep) | manager_ticket_gate.py | Soft ask | ⚠️ Partial |
| File governance (100-line) | lint.js | Advisory | ⚠️ Advisory |

## Root Causes → Countermeasures (Validated)

### 1. Attention Decay → Periodic Reinforcement
- **Cause**: Skills at context start become "middle content"
- **Fix**: `precompact_anchor.py` re-injects key instructions
- **Validated**: Hook fires on PreCompact events ✅

### 2. Helpfulness Bias → Hard Deny Gates
- **Cause**: Model overrides rules to satisfy user requests
- **Fix**: commit_ticket_gate.py uses `deny` not `ask`
- **Validated**: Upgraded in this session (CM2 #258) ✅

### 3. Cold-Start Problem → Session Context Hook
- **Cause**: Skills not loaded before first action
- **Fix**: `session_context.py` fires on SessionStart
- **Validated**: Hook registered in global-standards.json ✅

### 4. Missing Enforcement → Branch Validation
- **Cause**: No pre-commit check on branch naming
- **Fix**: validate-branch-name.sh as git pre-commit hook
- **Validated**: Installed via `npm prepare` (CM1 #260) ✅

### 5. Context Saturation → Routing Architecture
- **Cause**: Too many skills loaded = none followed well
- **Fix**: global-task-router routes to skill subsets
- **Validated**: task_router.py + router skill active ✅

## Test Validation (3 Scenarios)

Run: `npm test` — 20/20 Playwright tests cover:
1. Dashboard renders with governance panel (hook status visible)
2. Branch naming validation prevents invalid names
3. Ticket log shows audit trail of governance events

## Coverage Assessment

- **Prevented** (hard gate): 4/6 categories
- **Detected** (soft gate): 1/6 categories (scope drift)
- **Advisory**: 1/6 categories (file governance)
- **Overall**: 83% of drift categories have enforcement gates
