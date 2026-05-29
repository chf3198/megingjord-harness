> **SUPERSEDED-BY-v3** (2026-05-29): the canonical cross-team R&D protocol is now `instructions/cross-team-rd-synthesis.instructions.md` (v3). This v2 document is preserved for archeological reference and for §0 case-study tracking. New synthesis runs should consult the v3 instructions file. v3 incorporates dispatcher hybrid (#2393), admin rotation (#2394), per-team-MD canonical with optional GNAP overlay (#2395), K-S adaptive + 24h ceiling termination (#2396), A2A envelope wrapping, and tier-graceful degradation (#2400).

---

# Cross-Team R&D Protocol v2 — Iterative Debate with Evidence

**Author**: Orla Harper (claude-code:opus-4-7@anthropic, role: collaborator)
**Date**: 2026-05-09
**Ticket**: #1146 (R&D for Epic #1112)
**Lane**: docs-research; single-team-authored per bootstrap constraint (#1131 case study).
**Supersedes**: protocol v1 at `planning/protocol.md` (deprecated 2026-05-09 after #1131 SYNTHESIS_ABANDONED).

This document is the operator-approval-pending design for v2 of the cross-team R&D synthesis protocol. It exists to be reviewed, refined, and adopted as the canonical pattern for any future Epic that warrants multi-team R&D.

## §0 Why v2 exists (v1 case-study summary)

Protocol v1 (used in synthesis-1105 and synthesis-1131) was modeled on parallel-voting one-shot quiescence. The operator's intent was iterative-debate-with-evidence per the multi-agent debate literature (Du et al. 2024, NeurIPS 2025 stability detection). v1 produced 7 distinct failure modes:

| # | v1 Failure | v2 Fix (§ref) |
| --- | --- | --- |
| 1 | Substrate-vs-model team identity (Copilot Auto routing to Codex models made Copilot self-identify as cx) | §3 substrate-first identity, mandated in pre-flight check; #1145 registry fix |
| 2 | Concurrent-write across shared workspace (Codex committed CC's locally-uncommitted edits) | §6 strict file-ownership + central decision-ID allocator + lead-team-only commit-on-behalf rules |
| 3 | Decision-numbering collisions (no allocator) | §7 admin-allocated D-IDs; teams propose by title, admin assigns ID |
| 4 | Zero websearch citations (websearch was optional) | §4 websearch MANDATORY for opening plan AND for new debate claims |
| 5 | Zero cross-team challenge (one-shot post + quiesce) | §5 iterative debate waves; each wave requires reading peers' work |
| 6 | No active admin facilitation | §8 admin posts WAVE_SUMMARY each wave; challenges weak evidence; surfaces missed websearches |
| 7 | No baton handoff at synthesis end | §9 lead-team Manager → Admin → Consultant proper closeout |

## §1 Lead-team baton ownership (operator-stated requirement)

**One team owns the full Agile baton for the R&D ticket.** The other teams participate ONLY as collaborators in the R&D content.

```
   LEAD TEAM (one of cc, cp, cx — operator-assigned per ticket)
   ──────────────────────────────────────────────────────────────
   Manager:      scopes the R&D ticket; sets ACs; posts MANAGER_HANDOFF
   Collaborator: produces own Phase-R artifact + facilitates Phase-D as
                  admin (this dual role is structural; admin sub-role
                  uses a different alias surname per signer-independence)
   Admin:        verifies completeness; runs CI/lint gates; posts
                  ADMIN_HANDOFF (different alias surname from Collab)
   Consultant:   independent critique (different alias surname from
                  Admin); posts CONSULTANT_CLOSEOUT; closes ticket

   PARTICIPANT TEAMS (the other 1-2 teams)
   ──────────────────────────────────────────────────────────────
   Collaborator-only: produce own Phase-R artifact + participate in
                       Phase-D debate. No baton role on the ticket.
                       No admin/consultant authority.
```

**Lead-team selection** (operator-resolved 2026-05-09): the lead team is determined by **which session the operator initiates the R&D from**. If the operator requests team-collaborative R&D in the Claude Code session, Claude Code Team is the owner. If from Copilot Chat, Copilot Team is the owner. From Codex extension, Codex Team. The substrate of the initiating session = the lead team. Elegant, deterministic, and observable.

## §2 Phase order

```
   Phase-R   Independent first-pass R&D
             Each team (lead + participants) writes their own artifact.
             NO peer-read. WebSearch mandatory. Lead-team's Manager
             role posts the kickoff prompt + ACs first.

   Phase-D   Iterative debate
             All teams read all artifacts. Iterative waves of:
               - challenge / defend / concede positions
               - new websearch evidence per claim
               - admin posts WAVE_SUMMARY guiding convergence
             Wave count bounded; convergence-or-cap termination.

   Phase-C   Closeout via lead-team baton
             Lead-team Manager → Admin → Consultant standard
             baton sequence. Implementation children filed under
             parent Epic.
```

## §3 Pre-flight: identity verification

Each session, before posting anything, MUST verify substrate:

```
   1. Identify which extension panel you're in (substrate):
        github-copilot       → team cp
        codex-vscode-ide     → team cx (NEW substrate; needs registry
                                 entry per #1145)
        codex-cli            → team cx (alternative)
        claude-code-cli      → team cc
        claude-code-vscode   → team cc

   2. Team identity = substrate-derived (NOT model-derived).
   3. Alias seed = inventory/team-model-signatures.json lookup
      first by substrate, fallback to model.
   4. Sign every artifact with the substrate-correct team code
      and alias.
```

## §4 Phase-R: independent first-pass

### Rules

- **No peer reads**: do NOT open `<other-team>-rd.md`. Independence is the entire point.
- **No seeded R&D**: only the goal/task/issue text is the input. No prior consensus map, no admin-pre-staged decisions.
- **WebSearch MANDATORY**: opening plan must cite at least N=5 web sources (industry/academic/blog) addressing the topic. Format: `websearch: <URL> (accessed <ISO-8601-UTC>) — <one-line gist>`. The entire system relies on internet — no offline fallback exists or is needed (operator-resolved 2026-05-09).
- **Repo evidence MANDATORY**: at least N=10 file:line anchors grounding claims in the actual codebase. Format: `repo: path/file.ext#L<start>-L<end>`.
- **Contamination declaration MANDATORY**: every artifact starts with explicit declaration of what the author has read related to the topic before authoring (issue text counted, anything else flagged).

### Output

`planning/synthesis-<RD>/artifacts/<team>-rd.md` (where `<RD>` is the R&D ticket number; e.g., `synthesis-1146/artifacts/cc-rd.md`).

### Length target

200-400 lines. Less than 200 likely lacks evidence depth; more than 400 is harder to debate.

### Signal completion

```
RD-COMPLETE: <team> as <alias>, <team:model@substrate>, <line-count> lines,
N=<websearch-count> websearch citations, N=<repo-evidence-count> repo anchors.
```

## §5 Phase-D: iterative debate

### Wave mechanics

Each wave is bounded — operator dispatches a wave; teams have **up to 1 hour to respond** (operator-resolved 2026-05-09: 1 hour MAX per wave). Teams that finish faster signal completion immediately; admin proceeds when all three teams report wave-complete or 1h elapses.

```
   WAVE 1 (Initial peer review)
     Each team reads ALL peer artifacts (now allowed; was forbidden in R).
     Each team posts to their own debate file:
       planning/synthesis-<RD>/debate/<team>-wave-1.md
     Each post must include:
       - Top 3 points of agreement (with evidence)
       - Top 3 points of disagreement (with NEW websearch evidence
         beyond what's in their R&D)
       - Top 3 challenges to others' claims (with NEW websearch
         evidence — not just "I disagree")
       - 1+ NEW questions that emerged from peer review

   WAVE 2 (Defense + concession)
     Each team reads ALL Wave-1 posts.
     Each team posts to:
       planning/synthesis-<RD>/debate/<team>-wave-2.md
     Each post must:
       - Defend or concede each challenge from Wave 1 (no silence allowed)
       - Provide NEW websearch evidence for any defense
       - Explicitly answer the questions raised by other teams
       - Identify any newly-emerged decisions worth proposing

   WAVE 3+ (Convergence)
     Continue same pattern until convergence OR hard cap.
     Convergence = admin verifies (a) every disputed point has
     >=2-team agreement with cited evidence, OR (b) point is
     formally bracketed as "out of scope of this R&D".
```

### Admin facilitation per wave

Admin (lead-team's collaborator-acting-as-admin) reads ALL wave posts and writes:

```
planning/synthesis-<RD>/debate/admin-wave-<N>-summary.md
```

Each summary includes:

- Per-disputed-point: who's where, what evidence is solid, what evidence is weak
- Surfaced gaps: questions teams missed; websearches that should have happened
- Convergence assessment: % of points resolved; estimated waves to closure
- Stuck-point intervention: weak-evidence challenges; calls for specific further research
- Wave-N+1 dispatch: specific questions admin wants each team to address next wave

This is real work. The admin is a guiding judge, not a passive snapshot collector.

### Termination triggers (operator-resolved 2026-05-09)

- **Early termination — perfect agreement**: if admin verifies in WAVE_SUMMARY that ALL teams agree on EVERY disputed point with cited evidence, debate ends immediately. No need to iterate further. Move to Phase-C.
- **Convergence with residual stable disagreement**: if admin verifies that disputed points have either (a) full team agreement, OR (b) stable, evidence-grounded disagreement that is unlikely to resolve through more debate, **admin posts CLIENT_ESCALATION_NEEDED**. The operator joins the design discussion as a 4th voice and decides the residual points. Move to Phase-C only after operator weighs in.
- **EMERGENCY_HALT**: any team escalates to operator via dedicated comment block. Admin pauses; operator decides.

The protocol does NOT enforce a hard wave-count cap — perfect agreement triggers early termination, and stable residual disagreement triggers operator escalation. Both mechanisms prevent indefinite debate.

## §6 File-system shape (collision-resistant)

```text
planning/synthesis-<RD>/
  KICKOFF.md                      lead-team Manager-authored params
                                  (Epic#, R&D#, lead team, branch, dates)
  protocol-version.md             "v2" + reference to this document
  artifacts/
    cc-rd.md  cp-rd.md  cx-rd.md  Phase-R outputs (ONE per team;
                                   read-only after Phase-R RD-COMPLETE)
  debate/
    cc-wave-1.md  cp-wave-1.md  cx-wave-1.md   per-team Wave-1 post
    cc-wave-2.md  cp-wave-2.md  cx-wave-2.md   per-team Wave-2 post
    admin-wave-1-summary.md      lead-admin facilitation
    admin-wave-2-summary.md
    ...
  decisions.md                    admin-only; central D-NNN allocator
                                  + final verdicts
  status.md                       admin-only
  pulse.json                      admin-only
```

### File-ownership invariant

```
   Each team writes ONLY:
     - artifacts/<team>-rd.md (once, in Phase-R)
     - debate/<team>-wave-<N>.md (once per wave in Phase-D)

   Lead-team admin writes ONLY:
     - decisions.md, status.md, pulse.json
     - debate/admin-wave-<N>-summary.md
     - KICKOFF.md (at synthesis kickoff only; frozen thereafter)

   No team — including admin — writes another team's file. Ever.
   No team commits changes that include another team's files.
```

### Concurrent-workspace protection

When multiple agent VS Code extensions share one filesystem checkout (the #1131 root cause), v2 enforces:

- Each team's pre-commit hook checks: only this team's file paths in the staged diff. Reject otherwise.
- Lead-team admin has a special hook allowing admin-state files but still blocking other teams' artifact/debate files.
- Operator sees a warning when committing if another team's file is dirty.

The harness already has worktree-isolation infrastructure (`research/concurrent-agent-worktrees-2026-04-24.md`); v2 adds the per-team commit-scope enforcement.

### Decision-ID allocation

```
   Teams propose by title via PROPOSE_DECISION blocks in their
   debate posts:
     PROPOSE_DECISION: title="<plain English>"
     (no ID assigned by team)

   Lead-team admin allocates D-NNN sequentially in
   decisions.md. Admin's WAVE_SUMMARY surfaces the assigned ID
   so all teams reference it consistently.

   Numbering collisions impossible because only admin assigns.
```

## §7 Sign-off format

### Phase-R artifact (per file)

```yaml
---
artifact: <team>-rd.md
version: 1
phase: R
goal: "<R&D-ticket-title>"
ticket: #<RD-NUMBER>
parent_epic: #<EPIC>
team: <cc|cp|cx>
substrate: <github-copilot|codex-vscode-ide|claude-code-cli|...>
model: <model-id>
alias: <substrate-derived alias from registry>
contamination_declaration:
  read_before_authoring: [list of files/issues/web-sources opened]
  no_peer_artifacts_read: true
  websearch_count: N (must be ≥5)
  repo_anchor_count: N (must be ≥10)
last_activity_utc: <ISO-8601>
---
```

### Phase-D wave post (per file)

```yaml
---
phase: D
wave: <N>
team: <code>
agreements:
  - point: "<text>"
    cite_team: <other-team-code>
    cite_artifact: rd | wave-<M>
    evidence:
      - websearch: <URL> (accessed <UTC>)
      - repo: <path#L>
disagreements:
  - point: "<text>"
    cite_team: <other-team-code>
    cite_artifact: rd | wave-<M>
    rationale: <≤300 chars>
    new_evidence:
      - websearch: <URL> (accessed <UTC>) — REQUIRED for new disagreement
      - repo: <path#L>
challenges:
  - target_team: <team-code>
    target_claim: "<verbatim or paraphrase>"
    challenge: <≤300 chars>
    new_evidence:
      - websearch: <URL> (accessed <UTC>) — REQUIRED
new_questions:
  - "<question for next wave>"
proposed_decisions:
  - title: "<plain English>"
Signed-by: <substrate-derived alias>
Team&Model: <team:model@substrate>
Role: collaborator | consultant
last_activity_utc: <ISO-8601>
---
```

## §8 Admin facilitation duties (active, not passive)

The lead-team's admin role per wave:

1. Read every team's wave post end-to-end.
2. For each disputed point, judge evidence quality (is the websearch actually relevant? Is the repo anchor real?).
3. Allocate D-NNN to any new PROPOSE_DECISION titles surfaced this wave.
4. Identify weak evidence, missing perspectives, unanswered questions.
5. Write WAVE_SUMMARY with:
   - State of every disputed point
   - Specific guidance to each team for next wave
   - Convergence assessment (% resolved; remaining waves estimate)
   - Any emergency flags (stuck points, evidence-fabrication concerns)
6. Update `decisions.md` (running ledger), `status.md`, `pulse.json`.
7. Dispatch next wave (or signal Phase-C if converged).

Admin facilitation is the work. If admin role just collects timestamps, the protocol degenerates back to v1.

## §9 Phase-C: lead-team baton closeout

```
   1. Manager (lead-team) reads admin's final WAVE_SUMMARY.
        Drafts MANAGER_HANDOFF on R&D ticket capturing the
        consensus + child-ticket plan for parent Epic.

   2. Admin (lead-team, distinct alias surname from Collaborator):
        Verifies CI gates; runs lint:md / docs:lint / etc.
        Posts ADMIN_HANDOFF.

   3. Consultant (lead-team, distinct alias surname from Admin):
        Independent critique. Grades each team's contribution
        (lead + participants). Surfaces residual risks.
        Posts CONSULTANT_CLOSEOUT. Closes R&D ticket
        with status:done, resolution:completed.

   4. Implementation children filed against parent Epic
        per the consensus plan.
```

## §10 Operating discipline (summary)

- One team owns the baton; others contribute as collaborators only.
- Each team starts from scratch. No seeded R&D.
- WebSearch is mandatory: ≥5 in opening, ≥1 per new disagreement/challenge in debate.
- Each team writes only their own files. Period.
- Admin assigns decision IDs centrally — no parallel numbering.
- Admin facilitates actively each wave. WAVE_SUMMARY required.
- Lead-team Manager → Admin → Consultant baton at end. Different alias surname per role.
- Hard cap: 5 waves OR 72h wall-clock.

## §11 Bootstrap notes

This document was authored by Claude Code Team alone (single-team R&D), not via the v2 protocol. Reason: v1 is broken (#1131 case study); v2 doesn't yet exist; running v1 to design v2 would compound the failures it aims to fix. Operator design-review serves as Consultant role.

Future cross-team R&D Epics adopt v2 from kickoff.

## §12 Design questions — RESOLVED 2026-05-09

Operator (chf3198) reviewed the open questions on 2026-05-09 and provided the following answers, which have been folded into the protocol body above. Documenting here for traceability.

| Q | Decision |
| --- | --- |
| Wave length | **1 hour MAX** per wave. Teams that finish faster signal completion; admin proceeds when all 3 report wave-complete or 1h elapses. |
| Stopping criteria | **Early termination on perfect agreement.** If all teams agree on every disputed point in any wave, debate ends. No mandatory iteration count. |
| WebSearch fallback | **Not needed.** Entire system relies on internet; offline scenarios are out of scope. |
| Lead-team selection | **Substrate of initiating session.** Operator's session that requests the R&D becomes the lead team. (Operator initiating from Claude Code session → CC owns; from Copilot Chat → CP owns; from Codex extension → CX owns.) |
| Residual disagreement | **Operator escalation.** If debate reaches stable disagreement (no more movement), admin posts `CLIENT_ESCALATION_NEEDED`. Operator joins as a 4th voice in the design discussion and resolves residual points. |
| Migration of #1131 | **Re-run under v2** for the next applicable Epic. The synthesis-1131 architectural consensus is preserved as case-study evidence in the SYNTHESIS_ABANDONED comment but does not feed #1130 directly. New R&D ticket for Epic #1130 to be filed under v2. |

## §13 Validation plan

Per operator decision Q6, the first v2 validation run is a fresh R&D for Epic #1130 (universal HAMR coverage) under v2 from kickoff. This will be filed as a new R&D ticket replacing the cancelled #1131. Lead-team selection per Q4: determined by which session the operator initiates from.

---

## Sign-off

Signed-by: Orla Harper
Team&Model: claude-code:opus-4-7@anthropic
Role: collaborator (single-team R&D for #1146 per bootstrap constraint)
last_activity_utc: 2026-05-09T00:00:00Z
