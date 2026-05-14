# Issue #1435 Diagnosis: Cross-team-edit-warn Silent Failure

**Date:** 2026-05-13  
**Investigation:** Why `cross-team-edit-warn` workflow did not fire on parallel #1423/#1424 work  
**Scope:** Epic #1407 parallel work by Copilot Team and Claude Code Team  
**Signed-by:** GitHub Copilot  
**Team&Model:** copilot:gpt-5.3-codex@github

---

## Executive Summary

The `cross-team-edit-warn` workflow did **not fire** when Copilot Team and Claude Code Team independently picked up and implemented Epic #1407 children (#1423 and #1424). Investigation reveals three root causes:

1. **File-path-only trigger:** Workflow checks for shared-path vs. owned-path conflicts, but #1423 and #1424 had **no file-level overlap**.
2. **Missing semantic-level conflict detection:** No mechanism exists to alert on **issue-level parallel work** (same Epic parent, non-overlapping scope).
3. **No automatic cross-team coordination label application:** When teams claim Epic children, there's **no trigger** to prompt coordination or raise conflict flags.

---

## Incident Timeline

**2026-05-12 Early**
- Copilot Team begins Epic #1407 work (cross-team coordination epic)
- Independently picks up child #1423 (epic-traceability-lint), #1424 (governance docs)

**2026-05-12 Mid**
- Claude Code Team also begins Epic #1407 work
- Independently picks up child #1423 (epic-traceability-lint)
- Opens PR #1431 with identical scope to Copilot's in-flight work

**2026-05-12 Late**
- Copilot Team completes #1423, merges commits d88f890 and aa713cb
- Claude Code Team's PR #1431 becomes superseded
- **cross-team-edit-warn workflow did NOT fire** — no visible alert

**2026-05-12 Closeout**
- Claude Code Team closes PR #1431 as superseded
- Both teams finalize Epic #1407 closure

---

## Root Cause Analysis (H1, H2, H3)

### Hypothesis H1: cross-team-edit-warn only triggers on file overlap ✓ CONFIRMED

**Evidence:**
- Workflow source: `.github/workflows/cross-team-edit-warn.yml` lines 28–35
- Regex patterns: `sharedRe = /^(instructions\/|inventory\/|wiki\/)/` and `ownedRe = /^(scripts\/global\/|dashboard\/|cloudflare\/hamr\/)/`
- Logic: Workflow requires **both** `touchesShared AND touchesOwned` to post warn comment
- File inventory for #1423 and #1424:
  - #1423: `.github/workflows/epic-traceability-lint.yml`, `scripts/global/megalint/epic-ac-traceability.js` (owned only)
  - #1424: `docs/howto/governance-backfill-runbook.md`, `docs/howto/governance-quality-checklist.md` (owned only)
- Result: Neither PR touched both shared AND owned surfaces → **no warn triggered**

### Hypothesis H2: No cross-team-consult-pickup invocation for sibling coordination ✓ CONFIRMED

**Evidence:**
- `cross-team-consult-pickup` skill (`.claude/commands/cross-team-consult-pickup.md`) is scoped for **Epic-level Consultant closeout** only
- Trigger phrases: `cross-team consult #N`, `find cross-team work`, `pull cross-team`
- Not invoked for **sibling-child ticket parallel work** (no mechanism exists)
- First-claim-wins label application (`consultant:cross-team-needed` → `:in-progress`) is **Epic-level only**, not child-level
- Result: When both teams claimed #1423, there was **no atomic label conflict** and no **coordinator prompt**

### Hypothesis H3: Workflow fires but warn is advisory ✓ CONFIRMED (PARTIALLY IRRELEVANT)

**Evidence:**
- Workflow does post advisory comments (no merge block)
- Comment includes: "Warn only — does not block merge"
- However, this hypothesis is **irrelevant** because the workflow **never fired** (H1 showed no file-level conflict)
- Advisory nature is correct per Epic #922 "convergence-design item 7" (shared-surface edits should require coordination)

---

## Gap Analysis: Why Parallel Child Picks Went Undetected

### Mechanism 1: File-Level Conflict Detection (Current Implementation)

**Coverage:** ✓ Shared-path + owned-path simultaneous edits  
**Gap:** ✗ Semantic conflicts (same Epic children, different implementations)

Current scope assumes "cross-team work" means "shared infrastructure + team-owned implementation" (e.g., Copilot updates instructions/ while Claude Code updates dashboard/). But #1423 and #1424 were **semantic overlaps within a single Epic's child tickets**, not cross-team file edits.

### Mechanism 2: Issue-Level Claim Detection (Absent)

**Coverage:** ✗ No issue-level cross-team coordination mechanism for children  
**Need:** When multiple teams claim Epic children:
- Auto-generate `coordinator:cross-team-claimed` label when >1 team has claimed children of same Epic
- Trigger alert/prompt for coordination
- Reference `instructions/cross-team-consultant.instructions.md` for next steps

### Mechanism 3: Manager-Level Epic Coordination (Exists but Not Invoked)

**Coverage:** ✓ Epic-level Consultant closeout pickup (`cross-team-consult-pickup` skill)  
**Gap:** ✗ No Manager-level "cross-team children" coordination protocol

The `cross-team-consultant` protocol only fires at **closeout (Consultant role)**. There's no symmetrical **Manager-level** protocol to:
- Detect when teams are picking up Epic children in parallel
- Raise explicit coordination flags
- Prompt cross-team baton handoff or role-swapping

---

## Proposed Deliverables for #1435 Fix

### D1: Audit cross-team-edit-warn.yml Trigger Logic (DONE)

**Finding:**
- Trigger is correct for file-level conflicts (shared-path + owned-path edits)
- Scope limitation: Does not detect semantic conflicts (Epic-child parallel work)
- Recommendation: Keep file-level trigger as-is; add separate issue-level mechanism

### D2: Audit cross-team-consult-pickup Skill and Usage (DONE)

**Finding:**
- Skill is properly scoped to Epic-level Consultant closeout (per #1305)
- No usage pattern exists for Manager-level child-ticket coordination
- Recommendation: Design **new Manager-level skill** or extend existing protocol

### D3: Document Findings + Propose Fix (IN PROGRESS)

**Proposal A: Add issue-labels-based coordination alert** (Low Risk)
- When Copilot's commits land for Epic child #N, check if Claude Code also has an open PR for same #N
- Use GitHub API query: `gh pr list --base main --search "is:open #<parent_epic>"`
- Emit advisory comment on PRs if duplicates detected
- Label both with `coordinator:cross-team-needs-hand-off` to surface to operators

**Proposal B: Extend cross-team-consul-pickup to cover child-ticket Manager coordination** (Medium Risk)
- Design new trigger phrase: `cross-team coordinate #N` (for Epic parent)
- Script resolves team-of-record per child, queries for parallel PRs/claims
- Atomically applies `role:manager-cross-team-needed` label to parent Epic
- Posts coordination request comment with evidence anchor

**Proposal C: Add issue-event-based team-claim detection to cross-team-edit-warn.yml** (Medium Risk)
- Extend workflow to also trigger on `issues.labeled` events (not just PR events)
- Check if issue received `role:collaborator` or `role:admin` label
- Query for sibling Epic children with same role labels applied by different teams
- Post alert comment linking to coordination protocol

**Recommended:** **Proposal A (low risk)** with follow-up **Proposal C** as Tier-2 enhancement
- Proposal A requires only GitHub API queries + comment logic
- Proposal C extends existing workflow in bounded way
- Both avoid new skill/label proliferation for MVP

---

## Acceptance Criteria for #1435 Resolution

1. ✓ D1 complete: File-level workflow audit documented
2. ✓ D2 complete: Skill usage patterns documented
3. ✓ D3 complete: Findings + fix proposal posted to #1435 (this artifact)
4. Create follow-up ticket(s) for implementation (Proposal A, Proposal C)

---

## References

- #1407 — Epic: cross-team coordination governance  
- #1423, #1424 — Epic #1407 children (parallel work)  
- PR #1431 — Claude Code Team's superseded PR for #1423  
- `.github/workflows/cross-team-edit-warn.yml` — file-level conflict detection  
- `instructions/cross-team-consultant.instructions.md` — Epic-level closeout protocol  
- `.claude/commands/cross-team-consult-pickup.md` — Consultant pickup skill  
- #1305 — Cross-team Consultant pickup protocol (parent)  

---

## Appendix: Code Snippets

### Current cross-team-edit-warn.yml Trigger

```javascript
// Lines 28-35: Current file-path-only conflict detection
const sharedRe = /^(instructions\/|inventory\/|wiki\/)/;
const ownedRe = /^(scripts\/global\/|dashboard\/|cloudflare\/hamr\/)/;
let touchesShared = false, touchesOwned = false;
for (const f of files) {
  if (sharedRe.test(f.filename)) touchesShared = true;
  if (ownedRe.test(f.filename)) touchesOwned = true;
}
if (!(touchesShared && touchesOwned)) {
  core.info('no cross-cut edits detected — no warn needed');
  return;
}
```

### Proposed Issue-Level Alert Query (Proposal A)

```bash
# Check for parallel PRs on same Epic child
gh pr list --state open --base main --search "#1423" --limit 20 \
  --json number,title,author,createdAt --jq \
  'group_by(.author.login) | map(select(length > 1))'
```

---

**Status:** Research phase complete. D1, D2 delivered; D3 (this artifact) complete.  
**Next Step:** User decides whether to implement Proposal A/C or defer to later phase.
