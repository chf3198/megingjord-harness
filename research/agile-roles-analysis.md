# Agile Role Responsibilities — Critical Analysis

**Date**: 2025-07-18
**Ticket**: #72 (Epic #70)
**Sources**: Google SRE, Spotify Squad Model, Netflix Culture, MetaGPT, Platform Eng

## Role Ownership Matrix

| Role | OWNS exclusively | VERIFIES upstream | DELIVERS downstream |
|---|---|---|---|
| Manager | Problem definition, criteria, gates, risk budget | Request clarity, feasibility | Scoped work package with testable gates |
| Collaborator | Solution design, implementation, test strategy | Criteria testability, constraint realism | Working code + evidence per gate |
| Admin | Release mechanics, git hygiene, deployment | Tests pass, lint clean, evidence exists | Deployed artifact + ops evidence |
| Consultant | Independent review, risk scoring, grading | ALL prior roles' work quality | Critique report with grades + recommendations |

## Key Findings from Research

1. **MetaGPT validates baton handoff** — structured sequential with intermediate verification
2. **Netflix "informed captain"** — Manager owns decisions, farms for dissent
3. **Google SRE error budgets** — shared contract between scope-setter and implementer
4. **Spotify autonomy** — "live with consequences of design decisions"
5. **Platform Engineering** — ownership ≠ execution; clear handoff patterns

## Anti-Patterns per Role

- **Manager**: Prescribing "how" (kills autonomy), vague gates, over-specification
- **Collaborator**: Implementing without verifying scope, gold-plating, silent constraint drops
- **Admin**: Judging solution quality (that's Consultant), deploying without evidence
- **Consultant**: Changing scope, grading without evidence, grade inflation

## Actionable Next Steps

- Implement cross-verification matrix in role skills
- Add "give back the pager" escalation escape hatch
- Consultant must grade Manager, not just implementation
- Use structured artifacts as role interfaces
