# ADR-006: Visual QA Gate for Web Releases

**Status**: Accepted  
**Date**: 2025-07-16  
**Deciders**: Agent (self-annealing)

## Context

The v1.2.0 dashboard release shipped without visual inspection.
Three governance skills require visual QA before release, but the
requirement was documentary only. No hook blocked tagging or
session completion when visual QA was missing.

## Decision

Gate `git tag` and session completion on a `visual_qa` flag in
governance state for repos classified as `website-static` or
`web-app`.

### Enforcement points

1. **state_store.py**: `admin_ops.visual_qa` defaults to `False`
2. **pretool_guard.py**: Denies `git tag` when flag is `False`
3. **stop_checks.py**: Adds `visual_qa` to completion checklist
4. **visual_qa_record.py**: Sets flag and records evidence

### Evidence schema

```json
{
  "url": "http://localhost:8090/dashboard/",
  "capture": "fullPage",
  "verdict": "pass",
  "defects": []
}
```

## Consequences

- Releases on web repos require explicit visual sign-off
- Non-web repos are unaffected
- The gate is scoped to repo type, not global
- Agent must run Playwright + visual inspection before tagging

## Alternatives Considered

1. **Manual checklist only** — Failed; v1.2.0 proves it
2. **CI-only gate** — Not applicable; no CI pipeline yet
3. **Block all commits** — Too aggressive; only tag needs gating
