# EPIC-002: Visual QA Self-Annealing

**Status**: Complete  
**Priority**: Critical  
**Created**: 2025-07-16  
**Owner**: Agent

## Problem Statement

v1.2.0 dashboard release passed lint, smoke tests, and DOM-presence
Playwright tests — but shipped without visual rendering inspection.
Three skills mandate visual QA before release sign-off, yet no hook
enforced the gate. The process failure was caught only by client UAT.

## Root Cause

Classification: `missing guardrail` | Risk: `high`

Existing hooks covered admin sequencing (commit → push → PR → merge)
but had no gate for visual verification on web-type repositories.
The workflow-self-anneal (§8), playwright-vision-low-resource (§8),
and web-regression-governance skills all require visual inspection,
but the requirement was documentary only — not enforced in code.

## Fix Summary

| # | File | Change |
|---|------|--------|
| 1 | hooks/scripts/state_store.py | `visual_qa` flag in admin_ops |
| 2 | hooks/scripts/admin_patterns.py | `RE_GIT_TAG` regex |
| 3 | hooks/scripts/pretool_guard.py | Block git tag without visual_qa |
| 4 | hooks/scripts/stop_checks.py | visual_qa in completion gate |
| 5 | hooks/scripts/visual_qa_record.py | Record helper (new file) |
| 6 | instructions/visual-qa-governance.instructions.md | Rule doc |
| 7 | research/adr/006-visual-qa-gate.md | Decision record |

## Acceptance Criteria

- [x] `git tag` blocked when visual_qa not recorded on web repos
- [x] Stop hook warns when visual_qa missing for web repos
- [x] `visual_qa_record.py` sets flag and appends evidence
- [x] Lint passes on all modified files
- [x] All Python files compile without errors
- [x] ADR-006 documents decision
- [x] Release tagged and changelog updated

## Phases

1. **Diagnose** — Root cause analysis ✅
2. **Research** — Identify enforcement points ✅
3. **Develop** — Build guards and docs ✅
4. **Test** — Validate enforcement end-to-end ✅
5. **Release** — Tag, changelog, deploy ✅
