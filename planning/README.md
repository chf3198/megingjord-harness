# Cross-Team R&D Synthesis — Epic #1103 / #1105

Parallel multi-team synthesis of three independent R&D passes into a unanimous (or admin-tiebroken) implementation plan for Epic #1103 ("Harden harness goals across instructions and docs").

## Quick-start

Three roles, three prompts (in `planning/prompts/`):

| Role | Prompt(s) | Phase |
| --- | --- | --- |
| All teams (CC, CP, CX) | `team-rd.md` | Phase-R: independent first-pass R&D (only for brand-new R&D tickets without pre-existing research) |
| Admin (Claude Code Team) | `admin-init.md` | Phase-S: one-shot at synthesis-session start |
| Participant (Copilot, Codex) | `team-prep.md` then `team-init.md` | Phase-P + Phase-S: prep then init |

The operator dispatches each session by sending a short directive that points at the appropriate prompt file. See `planning/prompts/` for the full text.

Operating discipline (all roles):

1. Read `protocol.md` end-to-end.
2. Read all artifacts in `artifacts/` (read-only).
3. Append-only to your own files (per-team `positions/` and `threads/`).
4. **Never touch another team's file.** Parallel-safety invariant.
5. Set `quiescent: true` when you have nothing more to add.

## Team codes

- `cc` = Claude Code Team (admin: structural-only + final tie-break)
- `cp` = Copilot Team
- `cx` = Codex Team

## State files (admin-maintained)

- `status.md` — live state of open threads + quiescence
- `decisions.md` — promoted final verdicts per decision
- `pulse.json` — machine-readable activity timestamps + termination flags

## Termination

Synthesis ends by first-of:

1. All teams quiescent + all decisions resolved (target).
2. Per-decision stability across 2 consecutive admin snapshots.
3. 72h wall-clock cap (2026-05-10 end-of-day).
4. `EMERGENCY_HALT` posted by any team.

See `protocol.md` §7 for full mechanics.

## Open issues

See `status.md` for live state; `decisions.md` for resolved.
