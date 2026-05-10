---
name: Cross-Team Review Governance
description: Per Epic #1271 AC12 — codified pattern for cross-team review of closed parents.
applyTo: "**"
---

# Cross-Team Review Governance

Pattern surfaced by Epic #1271 Phase-0 R&D cycle: cross-team reviews of closed parents had no governed home, requiring ad-hoc filing of review-delivery tickets (#1282, #1284). This instruction codifies the pattern.

## Auto-file rule

When a closed issue receives more than 2 cross-team review comments within a 14-day window, the workflow `.github/workflows/cross-team-review-codify.yml` auto-files a `type:research` ticket with:

- Title: `Cross-team review delivery: <reviewing-team> review of #<closed-parent>`
- Body: links to the closed parent + the cross-team comments
- Labels: `type:research`, `status:backlog`, `lane:docs-research`, `area:governance`
- Manager prompt comment: "Pick up to scope review delivery"

## Cross-team comment definition

A "cross-team comment" is a comment on a closed issue whose author signature `Team&Model:` differs from the original closed-issue author's signature. Detection uses the `Team&Model:` field on the comment vs the issue body's signature line.

## Manual override

Operators or Managers may file a cross-team review ticket manually at any time. Auto-file is a backstop, not a mandate. To suppress auto-file on a closed issue, add label `no-auto-review` (e.g., for read-only status reports that organically attract cross-team attention without warranting a review-delivery ticket).

## Scope

Auto-file produces the ticket; the Manager who picks it up scopes the review per `instructions/role-baton-routing.instructions.md`. The auto-file workflow does NOT auto-route review work or auto-assign Consultants beyond the prompt comment.

## References

- Epic #1271 AC12
- Concrete instances: #1282 (CC↔CP), #1284 (CX round-2)
- OKR Benchmark Report 2026 (retrospective discipline)
