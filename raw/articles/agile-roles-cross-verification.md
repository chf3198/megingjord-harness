# Cross-Verification Matrix — Who Checks Whom

**Date**: 2025-07-18
**Ticket**: #72 (Epic #70)

## Verification Matrix

| Checker ↓ / Checked → | Manager | Collaborator | Admin |
|---|---|---|---|
| **Collaborator** | Feasibility of criteria, constraint realism | — | — |
| **Admin** | Work package format completeness | Tests pass, lint clean, evidence exists | — |
| **Consultant** | Scope quality, gate design, risk calibration | Solution quality, coverage, design | Process adherence, deploy cleanliness |
| **Manager (next cycle)** | — | — | Consultant recommendations incorporated |

## Redundant Checks: Value vs Waste

### High Value
- Admin re-running tests (catches environment-specific failures)
- Admin checking scope compliance (catches scope creep before deploy)
- Consultant grading Manager's scope (only upstream feedback loop)
- Collaborator pushing back on gates (feasibility check)

### Waste (Eliminate)
- Consultant re-reading every code line (audit evidence, not code)
- Manager checking implementation details (violates autonomy)
- Multiple roles doing same lint/test check (once is enough)

## Cutting-Edge Practices

1. **Error budgets as shared contracts** (Google) — joint gate ownership
2. **Informed captain + disagree-then-commit** (Netflix)
3. **"Give back the pager" escape** (Google SRE) — reject un-deployable work
4. **Squad health checks** (Spotify) — periodic self-assessment
5. **Context not control** (Netflix) — Manager provides context, not steps
6. **Structured artifacts as interfaces** (MetaGPT) — not prose handoffs

## Recommended Artifact Schema

- **Manager** → `{criteria[], constraints[], gates[], risk_tolerance}`
- **Collaborator** → `{gate_results[], test_output, notes}`
- **Admin** → `{deploy_log, pr_url, lint_results, release_notes}`
- **Consultant** → `{role_grades{}, risk_score, recommendations[], patterns[]}`
