# Cross-Team R&D Synthesis Protocol — Epic #1103 / R&D #1105

**Status**: Active
**Kickoff**: 2026-05-07
**Hard cap**: 2026-05-10 (72h wall-clock)
**Admin**: Claude Code Team (structural-only; no content arbitration except final tie-break per §6)

This protocol governs the parallel R&D synthesis stage among Claude Code Team, Copilot Team, and Codex Team. It is research-backed: termination, stability, and consensus mechanics derive from 2025-2026 multi-agent debate literature (see §9).

## §1 Roles

| Team | Code | Admin? | Role in synthesis |
| --- | --- | --- | --- |
| Claude Code | `cc` | YES (structural) | Participant + protocol enforcement + final tie-break |
| Copilot | `cp` | NO | Participant |
| Codex | `cx` | NO | Participant |
| Operator (chf3198) | `op` | YES (escalation) | Receives quiescence-failure reports; overrides admin tie-break |

**Admin scope (Claude Code Team)**:

- Maintains derived files: `status.md`, `decisions.md`, `pulse.json`, thread `meta.md` files.
- Enforces structural rules: signing format, file-naming, append-only discipline.
- Holds final tie-break vote when quiescence is reached but consensus is not (§6).
- **MUST NOT** edit other teams' position files or thread comment files. Pure read-only on those.

## §2 File-system shape (parallel-write safe)

```text
planning/
  README.md                  # entry point (frozen at kickoff)
  protocol.md                # this file (frozen at kickoff)
  artifacts/
    cc-rd.md                 # Claude Code R&D (read-only)
    cp-rd.md                 # Copilot R&D (read-only)
    cx-rd.md                 # Codex R&D (read-only; TBD if not yet authored)
    INDEX.md                 # section-level reference table
  threads/
    T-<team>-<NNN>-<slug>/   # thread, opened by team <team>
      meta.md                # admin-maintained header
      cc.md                  # Claude Code's append-only comments
      cp.md                  # Copilot's append-only comments
      cx.md                  # Codex's append-only comments
  positions/
    cc.md                    # Claude Code's running position log + verdicts
    cp.md                    # Copilot's
    cx.md                    # Codex's
  decisions.md               # admin-curated; promotes from positions when consensus reached
  status.md                  # admin-curated; live state of open threads + quiescence
  pulse.json                 # machine-readable activity timestamps + quiescence flag
```

**Parallel-safety invariant**: at most one writer per file. No team touches another team's file. This eliminates lock contention without `write-safety.js` changes (those changes are tracked in #1111 for future enhancement).

**Strict non-mutation rule (Copilot Team addition)**: a participating team's writes are limited to:

- `planning/positions/<your-team-code>.md` (append-only)
- `planning/threads/T-<your-team-code>-NNN-*/<your-team-code>.md` (your comments on threads you opened)
- `planning/threads/T-<other-team-code>-NNN-*/<your-team-code>.md` (your replies on threads opened by other teams)

**Decision-lock rule**: `decisions.md` is admin-only. No participating team writes to `decisions.md`, `status.md`, or `pulse.json` — those are admin-maintained derived state. Teams influence `decisions.md` by posting verdicts in their position files; admin promotes when consensus or stability is reached (§6, §7).

**Thread-creation ownership**: a team may create only `planning/threads/T-<their-own-team-code>-NNN-*/` directories. A team must not create thread directories with another team's prefix.

## §3 Thread opening

Threads are owned by the team that opens them. ID format: `T-<team-code>-<NNN>-<slug>`.

- `T-cc-001-include-claim-verification` (Claude Code opened)
- `T-cp-001-effort-estimate-skepticism` (Copilot opened)
- `T-cx-001-codex-runtime-drift` (Codex opened)

Numbers are per-team (each team starts at 001). Slug is kebab-case ≤40 chars. To open a thread, a team:

1. Creates `planning/threads/T-<team>-<NNN>-<slug>/` with their own `<team>.md` file containing the opening argument.
2. Appends a one-line entry to `planning/positions/<team>.md`: `Opened T-<team>-<NNN>-<slug>: <one-sentence summary>`.
3. Admin (CC) creates the corresponding `meta.md` within ≤6h.

## §4 Indexing scheme

All cross-references use bracketed tags. Greppable, parseable, no ambiguity.

**Artifact section refs** (point INTO an R&D doc):

- `[CC-RD §4-G3]` — Claude Code R&D, §4 (enforcement map), G3 row
- `[CP-RD R3.b]` — Copilot R&D, R3, item b
- `[CX-RD scope-issue-2]` — Codex R&D, named anchor

**Thread refs**: `[T-cc-001]`, `[T-cp-002]`, `[T-cx-001]`.

**Reply markers** (in a team's thread comment file):

- `>> [T-cc-001 cp-2]` — replying to Copilot's 2nd comment in T-cc-001
- `cf:[CC-RD §4-G3]` — citing source evidence

**Decision IDs**: `D-NNN` global, admin-assigned at promotion time. Tracked in `decisions.md`.

## §5 Sign-off format

Every position statement is per-decision (not per-team-globally). In `positions/<team>.md`, the team appends a YAML block:

```yaml
---
decision_ref: D-001              # if known; else null
threads: [T-cc-001, T-cp-003]    # threads informing this position
verdict: agree | disagree-not-blocking | disagree-blocking | abstain
rationale: <≤200 chars>
evidence:
  - cf:[CC-RD §6.2]
  - websearch: <URL> (accessed <ISO-8601-UTC>)
  - repo: <path/file.ext>#L<start>-L<end>
Signed-by: <human-alias>
Team&Model: <team>:<model>@<substrate>
Role: consultant
last_activity_utc: <ISO-8601>
quiescent: true | false           # true = "I have nothing more to add on this decision"
---
```

**Evidence-format precision (Copilot Team addition)**:

- `repo:` references MUST include line range using GitHub-style anchors: `repo: scripts/global/foo.js#L42-L58` (or `#L42` for a single line). Plain paths like `repo: scripts/global/foo.js` are insufficient — they don't anchor the claim.
- `websearch:` references MUST include the access timestamp in parentheses: `websearch: https://example.com/page (accessed 2026-05-08T03:00:00Z)`. This protects against link-rot and dated-content drift.
- `cf:` (cross-file references to other planning artifacts) use the bracketed indexing scheme from §4 — no line ranges needed.

**Verdict vocabulary**:

- `agree` — full sign-off
- `disagree-not-blocking` — disagrees on the merits but accepts the consensus (counts as PASS)
- `disagree-blocking` — refuses the proposed decision; escalates to admin tie-break
- `abstain` — out of scope or insufficient information

## §6 Consensus + tie-break rules

For each decision, count team verdicts:

| 3-team verdict pattern | Outcome |
| --- | --- |
| 3× agree | **PASS** |
| 2× agree + 1× disagree-not-blocking | **PASS** |
| 2× agree + 1× abstain | **PASS** (abstainer noted) |
| 2× agree + 1× disagree-blocking | **admin tie-break** |
| 1× agree + 2× disagree (any) | **FAIL** |
| Otherwise | **admin tie-break** |

**Admin tie-break (Claude Code Team Consultant)**: when invoked, admin posts a Tie-break Block in `decisions.md` containing: synopsis of each team's argument, admin verdict (agree/disagree), rationale (≤300 chars), and `Role: admin-tiebreak` signature.

**Operator escalation triggers**:

- Admin tie-break is invoked on >25% of total decisions
- Any team posts `EMERGENCY_HALT` (see §8)
- Wall-clock cap reached (§7)

When triggered, admin produces `planning/escalation.md` for operator review and pauses synthesis.

## §7 Termination criteria (research-backed)

Synthesis terminates by **first-of**:

1. **Quiescence + Consensus**: all three teams have `quiescent: true` on every open decision AND all decisions have a final verdict in `decisions.md`. (Default termination — what we hope for.)
2. **Stability detection** (per decision): if a decision's verdicts have not changed across 2 consecutive admin snapshots (admin snapshots every 6h), the decision is `stable`. Stable decisions auto-promote to final state per §6 rules. (Inspired by Kolmogorov-Smirnov adaptive stopping in NeurIPS 2025 multi-agent debate work.)
3. **Wall-clock hard cap**: 72h from kickoff (2026-05-10 end-of-day). All un-stable, un-resolved decisions go to admin tie-break with `forced: true`.
4. **Emergency halt**: any team posts `EMERGENCY_HALT` block — admin pauses, generates escalation.md, awaits operator.

**Why no rounds**: rounds force synchronous turn-taking. The literature's adaptive-stability + judge-based termination is round-agnostic — it watches for distributional convergence regardless of who spoke when. Our implementation: per-team append-only logs + admin snapshots = round-equivalent without coordination overhead.

## §8 Emergency halt

Any team may post in their position file:

```yaml
---
EMERGENCY_HALT: true
reason: <≤500 chars; describe fundamental disagreement requiring operator input>
Signed-by: <alias>
Team&Model: ...
last_activity_utc: ...
---
```

Admin will:
1. Update `pulse.json` with `halt: true`.
2. Generate `planning/escalation.md` summarizing all open decisions and the halt reason.
3. Notify operator via #1105 comment.
4. All teams pause until operator responds.

## §9 Research provenance

Termination + stability mechanics derive from:

- Multi-Agent Debate for LLM Judges with Adaptive Stability Detection (NeurIPS 2025): KS-statistic stability ε=0.05 across 2 consecutive ticks
- AutoGen v0.4 (2026): hard caps + termination strings + async event-driven coordination
- LangGraph: persistent-state checkpointing for parallel paths
- S²-MAD (NAACL 2025): redundancy filtering to cut token costs
- Distributed-systems quiescence detection (classical): no-activity timeout per actor

Per-team verdict + admin tie-break is novel to this protocol; it is a small extension of judge-based adaptive termination where the judge is structurally constrained (admin tie-break only, not content arbitration).

## §9.5 Phase-R (independent R&D) — for brand-new R&D tickets

When a synthesis run begins from a brand-new R&D ticket with NO pre-existing research artifacts (vs. the #1105 case where each team had authored their R&D over prior days), Phase-R precedes Phase-P (prep).

**Phase-R rules**:

- Each team independently produces `planning/artifacts/<team-code>-rd.md`
- During Phase-R, teams do NOT read each other's R&D artifacts (preserves independence)
- Each team signals completion with `RD-COMPLETE: <team-code> as <alias>, ...`
- After all three teams report `RD-COMPLETE`, operator advances to Phase-P (prep)
- Admin (Claude Code Team) does NOT participate in Phase-R independence except as their own first-pass; admin role activates at Phase-S (synthesis init)

**Why Phase-R exists**: the prep+init phases assume `artifacts/<team-code>-rd.md` files exist. Without Phase-R for new R&D tickets, prep would fail with "no artifacts to read." Phase-R fills the gap.

**Prompt**: `planning/prompts/team-rd.md`

## §10 Operating discipline

- **No edits to another team's file. Ever.** This is the parallel-safety invariant.
- **Append-only within your own thread comment files.** Don't rewrite history.
- **Sign every position block.** Unsigned blocks are ignored by admin.
- **Cite evidence with precision.** Repo refs use `path/file.ext#Lx-Ly`; web URLs include `(accessed <UTC>)`; `cf:[<ref>]` for other planning artifacts.
- **`last_activity_utc` must be present and accurate.** Admin uses it for quiescence detection.
- **Set `quiescent: true` when you have nothing more to add.** Then walk away.
- **Anti-spam guard (Copilot Team addition)**: if you have already posted `quiescent: true` on a decision, do NOT post again on that decision unless **new evidence changes your verdict**. Re-emphasizing the same position without new evidence is noise and skews stability detection. If your evidence is genuinely new, append a fresh block referencing the prior block's timestamp and explain what changed.

---

Signed-by: Cole Mason
Team&Model: claude-code:opus-4-7@anthropic
Role: manager (admin)
