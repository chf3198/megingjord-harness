# ADR-021 — The operative ruleset is the working tree: snapshot-first before harness mutation

- **Status:** Accepted (Epic #3576 W-A A2; foundation for all #3576 children)
- **Date:** 2026-07-03
- **Deciders:** Manager → Collaborator (author) → Admin → Consultant baton on #3580
- **Refs:** Epic #3576 (E9, E12) · dev #3580 (W-A) · rescue snapshot `copilot-governance@rescue-pre-optimization-20260703` (commit `7ea4071`)
- **Consensus gate:** free cross-family panel (groq/meta + mistral) via `cross-family-consensus.js`; receipts in `governance/cross-family-consensus.jsonl`

## Context

Epic #3576's evidence pass established that the harness's **live enforcement plane is
unversioned working-tree state**, not committed history:

- **E9 (CONFIRMED):** the deployed Copilot runtime (`~/.copilot` → `copilot-governance`) carried
  **39 modified + 147 untracked** files (incl. 66 hook scripts) over a `main` whose last commit was
  **2026-04-11**. `hooks/global-standards.json` loads hooks **from the working tree**, so the
  uncommitted state *is* live policy. A `git checkout`, `git stash`, or an inverse `sync.sh` run
  (#2355) would silently revert live governance behavior to a 3-month-old baseline with no diff to review.
- **E12 (NEW):** other team runtime surfaces are **worse** — `~/.codex` and `~/.antigravity` are not
  git repositories at all. There is no snapshot to roll back to and no history of what the live policy was.

The consequence: any git operation touching hook or instruction files changes live behavior, and there
was no preserved baseline to recover. This is a G1 (Governance) and G6 (Resilience) exposure at the
foundation of every other workstream in #3576 — which is why W-A is the **P0-blocking** child.

## Decision

**1. Declare the invariant.** The operative ruleset of a team runtime surface is its **working tree**,
not its committed `HEAD`. Therefore: *any* git operation that mutates hook/instruction/validator files
(checkout, reset, stash, inverse-sync, rebase) mutates live policy and MUST be preceded by a verbatim
rescue snapshot.

**2. Snapshot-first is mandatory before harness mutation.** Before the first mutation of a runtime
surface, capture the entire working tree (modified + untracked, `.gitignore`-respecting so secrets are
excluded per G4) to a dedicated `rescue/<slug>-<ISO-date>` branch **and** matching tag, and push both.
The snapshot is created with git **plumbing** (`write-tree` → `commit-tree` → `branch`/`tag` → `reset`)
so the live working tree and the operator's current branch are left **byte-identical** — preservation
must not itself perturb the live plane.

**3. Generalize the treatment across all teams (E12).** Every team live-policy surface
(`copilot-governance`, `~/.codex`, `~/.antigravity`, and any future onboarding team) is brought under
the same snapshot + rolling `anneal/<ISO-week>` branch contract. The treatment is defined once and
applied per team; non-git surfaces are `git init`-ed and given the same rescue baseline.

## Consequences

**Positive**
- A recoverable baseline of live policy now exists off-machine (G6). The #3576 rescue snapshot
  `rescue-pre-optimization-20260703` preserves 5728 files of previously-unversioned live state.
- The snapshot-first rule makes destructive-revert classes (#2355 inverse-sync regression;
  checkout-reverts-live-policy) recoverable rather than silent.
- Establishes the precondition that lets every other #3576 workstream mutate the harness safely.

**Negative / cost**
- Rescue branches are large (thousands of files incl. `hooks/state`, `wiki/work-log`); they are
  preservation artifacts, not review targets, and are not merged to `main`.
- The invariant is currently **operator-enforced**; a pre-mutation guard hook that checks for a fresh
  rescue snapshot before allowing a hook/instruction-touching git op is scoped as a W-A A3 follow-on
  (commit-gate carve-out accepting `incident:<pattern_id>` refs for the anneal lane).

**Neutral**
- The long-term fix is to migrate the live plane onto committed state + a deploy step so the working
  tree stops *being* the policy; that is out of scope for #3576 (which preserves and version-controls
  the plane as-is) and is noted here as the successor direction.

## Alternatives considered

- **Commit the working tree straight to `main`.** Rejected: bundles 3 months of undifferentiated
  live drift into history with no review, and could itself alter behavior via merge/normalization. The
  rescue branch preserves verbatim without touching `main`.
- **Do nothing / rely on redeploy.** Rejected: no committed baseline exists to redeploy *from*; that
  is the exposure (E9/E12).
