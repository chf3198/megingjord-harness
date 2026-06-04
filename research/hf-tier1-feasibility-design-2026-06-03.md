---
title: Hugging Face Hub as a Tier-1 alternative to GitHub — feasibility + adapter design
date: 2026-06-03
lane: docs-research
source_tickets: [2398, 2642, 2412]
---

# Hugging Face Hub as a Tier-1 alternative (Epic #2398 AC2)

Tier-1 is the harness baseline: a remote repo-management account hosting the
**ticket-IS-the-baton** contract (`instructions/resource-tier-portability.instructions.md`).
GitHub is the only Tier-1 surface today. This investigates whether Hugging Face
Hub can be a second Tier-1 surface, and designs the adapter that would abstract
the baton over it. **Implementation is out of scope here** (re-scoped to a
follow-on Epic); this is AC2's investigation deliverable only.

## Primitive mapping (GitHub → Hugging Face)

| GitHub primitive (Tier-1) | Baton role | Hugging Face equivalent | Verdict |
|---|---|---|---|
| Issue | the baton object | Hub **Discussion** (repo/model/dataset/Space) | ✅ equivalent |
| Issue comment | baton handoff artifacts | Discussion **comment** (Markdown) | ✅ equivalent |
| Labels | `status:*` / `role:*` state | **no native labels** on Discussions | ⚠️ gap — encode in a pinned status comment or title prefix |
| `Refs #N` / cross-links | ticket linkage | Discussion URL / `#N` in body (no native backref) | ⚠️ partial — convention-only |
| PR | review/merge unit | Hub **Pull request** (git-backed) | ✅ equivalent |
| Actions (CI gates) | validators | **no hosted CI**; Spaces can run jobs | ❌ gap — gates run client-side or via a Space |
| Releases | release evidence | git tags on the repo | ✅ adequate |

**Verdict: PARTIAL-FEASIBLE.** Discussions + PRs + tags cover the core baton
(ticket, artifacts, review, release). The blocking gaps are **labels** (state
machine) and **hosted CI** (validator gates) — both have workarounds but neither
is native.

## Adapter interface (what the harness would need)

A `repo-substrate` adapter abstracting the ~6 operations the baton uses today,
with a GitHub impl (exists) and an HF impl (the follow-on build):

```
createTicket(title, body, labels) -> id
addArtifact(id, markdown)               // comment
setState(id, {status, role})            // GH: labels; HF: pinned status comment
readTicket(id) -> {title, body, artifacts, state}
linkRef(id, targetId)                   // GH: Refs; HF: URL convention
openChange(branch) / mergeChange(id)    // PR
```

- **Labels gap** → HF impl encodes `status:*`/`role:*` in a single pinned
  `BATON_STATE` comment (parse/replace), preserving the single-status invariant.
- **CI gap** → validators run as a local pre-push step (already exist as Node
  scripts) and/or a Hugging Face **Space** scheduled job; the gate evidence is
  posted as a Discussion comment rather than a Checks API result.

## What the follow-on implementation Epic must build

1. The `repo-substrate` interface + GitHub adapter refactor (extract today's `gh`/MCP calls).
2. The HF adapter (`huggingface_hub` API: Discussions, comments, PRs, tags).
3. `BATON_STATE` pinned-comment state encoder/decoder (labels substitute).
4. Validator-as-Space or local-only gate path + comment-posted evidence.
5. Tier-1 selector wiring (`MEGINGJORD_REPO_SUBSTRATE=github|huggingface`).

## Risks and recommendation

The two workarounds are real compromises, not parity — name them honestly:

- **Pinned `BATON_STATE` comment (labels substitute)** is the highest-risk piece:
  no atomicity, parse-fragile, and a concurrent writer can clobber it. Mitigation:
  reuse the **atomic ref-CAS** pattern from the #2489 GitHub-native synthesis (treat
  one git ref as the single source of truth; re-read, never blind-merge), and a
  strict `BATON_STATE` schema with a validator. Until proven, this is the gating risk.
- **Comment-posted CI evidence** is weaker than a Checks API result: it is advisory,
  not a hard merge gate, so a malicious/buggy actor can post a passing-looking comment.
  Mitigation: sign the gate evidence (Ed25519, as baton artifacts already are) and
  verify the signature in the local pre-merge step.

**Recommendation: pursue as an OPT-IN Tier-1 alternative, gated behind a spike.** The
follow-on Epic should begin with a thin spike (Discussions + one PR round-trip + the
`BATON_STATE` encoder) and a replay-eval against a real ticket before committing to
the full adapter — not a big-bang build. Do not flip any default to HF until parity is
proven per-operation (mirrors the #2489 "prove parity before flipping a route" rule).

## Goal-lens

- **G5**: a second Tier-1 surface widens the baseline beyond a single vendor — the
  core portability win this Epic targets.
- **G3/G1**: HF free tier is $0 and the baton governance contract is preserved via
  the adapter; the label/CI gaps are encoded, not dropped.

Refs Epic #2398 AC2 · Refs #2412 taxonomy · follow-on implementation Epic TBD
