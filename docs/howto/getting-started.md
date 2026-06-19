# Getting Started — operator first session (Tutorial)

A short, ordered walkthrough for an AI operator's first governed session in this harness. This is a
**tutorial** (learning-oriented, per `docs/diataxis-taxonomy.md`) — follow it top to bottom once; for
specific tasks afterward, use the how-to guides in `docs/howto/`.

## 1. Understand the model

The GitHub issue **is** the baton. You (the AI operator) run all four roles in sequence —
Manager → Collaborator → Admin → Consultant — one at a time. The human is the **client** (design
direction + UAT only). See `governance/README.md` for the four invariants.

## 2. Start from a ticket

Every change needs a GitHub issue first. Never code before a Manager scope comment exists on the
ticket. Branch naming: `feat/<issue#>-slug` or `fix/<issue#>-slug`.

## 3. Work in a dedicated worktree (never the main checkout)

The main checkout is canonical/read-only during sessions. Create an isolated worktree:

```bash
git worktree add ~/devenv-ops-<N> -b feat/<N>-slug
cd ~/devenv-ops-<N>
```

`node_modules` auto-links from the main checkout (per #1378).

## 4. Post the baton artifacts on the ticket

Before opening a PR, post all four on the linked issue: `MANAGER_HANDOFF`, `COLLABORATOR_HANDOFF`,
`ADMIN_HANDOFF`, `CONSULTANT_CLOSEOUT`. Build them with
`node scripts/global/baton-comment-build.js` so signing fields are correct.

## 5. Prefer the $0 review lane

Cross-family review runs on the free fleet/free-cloud lanes — never a paid provider by default
(goal G3). The optimal fleet rater is selected by quality > cost > speed (Epic #3126).

## 6. Open the PR, wait for green, merge

PR body carries `Refs #N` + a merge-evidence line. Wait for all required checks green before merge;
then the Consultant closes the issue after `CONSULTANT_CLOSEOUT`.

## Next

- How-to guides: `docs/howto/`
- Architecture overview: `ARCHITECTURE.md`
- The taxonomy behind these docs: `docs/diataxis-taxonomy.md`
