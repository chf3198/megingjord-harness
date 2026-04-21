---
applyTo: "**"
---

When asked to "complete" a feature-add (or equivalent language), completion requires all four role batons:

1) Manager complete → `MANAGER_HANDOFF` emitted, `status:ready` set
2) Collaborator complete → `COLLABORATOR_HANDOFF` emitted, `status:testing` set
3) Admin complete → `ADMIN_HANDOFF` emitted, `status:review` set
4) Consultant closeout → `CONSULTANT_CLOSEOUT` emitted, `status:done` set, issue closed

Each role must emit its named artifact before the next role begins.
Do not stop at "tests pass". Tests passing only closes Collaborator.

## Ticket-first requirement

Before any implementation begins, a GitHub issue **must** exist:
- Manager creates via `gh issue create` or links to an existing issue.
- All commits reference the issue (`#N` or `Closes #N`).
- PR links to the issue with `Closes #N` in the body.
- Issue is closed only after merge + verification evidence.

## Admin completion contract (required before claiming done)

- Version collision check (Marketplace/tag/package alignment)
- Commit + push + PR creation with issue linkage
- CI green verification
- Merge
- Publish/release work (if applicable)
- Release integrity verification
- Issue closure comment with released version evidence

## Documentation coverage matrix (required)

For behavior/config changes, confirm all applicable docs are updated:
- root README
- extension README
- root + extension CHANGELOG
- design docs (system-stability and related)
- contributor/governance docs (.github/CONTRIBUTING, PR template)
- public profile/community docs when workflow changes impact contributors

If any item is intentionally N/A, state N/A + reason explicitly.

Never claim "feature complete" with uncommitted worktree changes.
