---
description: "Cross-team Consultant pickup protocol. Trigger phrases: cross-team consult #N, find cross-team work, pull cross-team. Lists Epics needing a Consultant signed by a non-lead team; claims atomically via first-claim-wins."
argument-hint: "[#N | find]"
---

# Cross-Team Consult Pickup

## Purpose

Receiving-team protocol for picking up Epic-level Consultant closeouts that the lead-team Manager cannot sign (signer-independence + regulatory baseline). See `instructions/cross-team-consultant.instructions.md` for full design.

## Trigger phrases

- `cross-team consult #N` — claim a specific Epic if available
- `find cross-team work` — list available cross-team consult queue
- `pull cross-team` — same as `find cross-team work`

## Resolution

1. Run `node scripts/global/cross-team-queue.js --my-team auto` to:
   - Resolve caller substrate from `inventory/team-model-signatures.json`
   - List Epics labeled `consultant:cross-team-needed` whose Manager-of-record team ≠ caller team
   - For each candidate: check for existing `CROSS_TEAM_CLAIM` comment (skip if claimed)
2. For a chosen Epic, the script emits the `CROSS_TEAM_CLAIM` comment and swaps the label `:needed → :in-progress` atomically (first-claim-wins per the queue protocol).
3. The script re-reads comments after a brief delay; if another team's earlier-timestamped CLAIM exists, it posts `CROSS_TEAM_CLAIM_YIELD` and aborts cleanly.

## After successful claim

1. Read the Epic body and the closeout-request comment (the canonical evidence anchor).
2. Run `role-consultant-critique` independently: rubric scoring against G1–G9, AC verification, risk register.
3. Post `CONSULTANT_EPIC_CLOSEOUT` signed with caller team's Consultant alias (e.g., `<team>:Vale`).
4. Apply `resolution:released` label on the Epic.
5. Close the Epic (Consultant authority).
6. Label state cleanup: remove `consultant:cross-team-in-progress`; the close transitions to terminal state.

## Authority + signer rules

- Only the receiving-team Consultant alias (Vale-surname per `inventory/team-model-signatures.json`) may sign cross-team closeout.
- Signer-substrate gate (`baton-gates.yml` extension, AC6 — see follow-up ticket) enforces that the closeout signer's `Team&Model` substrate matches the active CLAIM substrate. Mismatch fails the merge.

## See also

- `instructions/cross-team-consultant.instructions.md` — full protocol design
- `scripts/global/cross-team-queue.js` — substrate-aware queue resolver
- `role-consultant-critique` — independent post-execution rubric
- `inventory/team-model-signatures.json` — substrate registry
