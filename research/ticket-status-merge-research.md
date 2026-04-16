# Q5 Research — Parallel Branch Conflict Prevention

**Ticket**: #118 | **Topic**: Eliminating the redundant Admin pull problem
**Date**: 2026-04-16

---

## The Problem

When a Collaborator sets READY-FOR-TESTING, their branch is up to date with master
**at the moment they push**. By the time Admin pulls and tests, another branch may
have been merged. Admin must pull latest into the branch before testing — this is
the "redundant pull" the operator identified. There is no zero-conflict guarantee.

---

## Industry Solutions Researched

### 1. GitHub Merge Queue (GitHub Free/Enterprise)

GitHub creates a temporary branch `main/pr-N` that combines the PR's changes
with the **current tip of main + all PRs ahead of it in the queue**. CI runs on
this combined branch. If it passes, the merge happens automatically in order. If
a PR fails, it is removed from the queue and later PRs rebuild without it.

**Effect on this workflow**: If Collaborator opens a PR and Admin adds it to the
merge queue, the "pull latest" step is automated. GitHub tests the branch *as if
it were already merged*, eliminating the manual Admin pull step entirely.
PASSED-TESTING would be set after the merge queue completes successfully.

**Constraint**: Requires Actions/CI configured with `merge_group` event trigger.
Available on public repos + org repos. Not available on personal private repos
without GitHub Enterprise.

### 2. GitLab Merge Trains (Premium/Ultimate tier)

Each MR in the train runs a pipeline against: target branch + all preceding MRs
combined. If one fails, it is removed and later pipelines rebuild without it. Up
to 20 parallel pipelines. Provides the same guarantee as GitHub merge queue.

**Constraint**: GitLab Premium tier required. Not applicable to GitHub-hosted repos.

### 3. Martin Fowler / Trunk-Based Development — Integration Frequency

Fowler (2020): "Frequent integration increases the frequency of merges but
reduces their complexity and risk." The key insight is that **short-lived branches
+ high-frequency integration** mathematically reduce the conflict window. If a
Collaborator's branch lives for 1-2 days and integrates frequently against main,
the surface area for Admin to encounter a new conflict is small.

**Effect**: Short-lived feature branches (≤2 days per TBD.com) nearly eliminate
the problem by minimizing divergence time. This is a process solution, not a
tooling solution.

### 4. Semantic Conflicts: The Irreducible Remainder

Fowler identifies "semantic conflicts" — where text merges cleanly but behavior
breaks. **No automation detects these**. Only tests catch them. This is why the
Admin's TESTING step (run tests on the merged state) is irreplaceable even if a
merge queue handles the merge itself.

---

## Recommendations for This Workflow

**Optimal path**: Use GitHub Merge Queue.
- Collaborator opens PR → sets READY-FOR-TESTING → Admin adds PR to merge queue
- Merge queue creates temp branch: `main/pr-N` (main + this PR)
- Admin runs tests against `main/pr-N` (the merge queue branch), not the raw feature branch
- If tests pass and CI passes → merge queue auto-merges → PASSED-TESTING is set
- Admin never needs to manually pull; the merge queue handles integration

**Fallback (no merge queue)**: The current design (Collaborator pulls latest,
Admin also pulls latest into branch before testing) is the correct industry-standard
redundant-pull approach. It does not fully eliminate risk, but it is the best
available non-automated option and is consistent with how GitLab MR workflows
operate without merge trains.

**Protocol addition**: When merge queue is not available, the transition guard for
TESTING→PASSED-TESTING should require: "Admin has pulled latest master into branch,
run tests, and confirmed no conflicts since last Collaborator commit."
