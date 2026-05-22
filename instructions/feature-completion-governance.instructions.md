---
applyTo: "**"
---

When asked to "complete" a feature-add, all four baton roles are required. Tests passing only closes Collaborator — do not stop there.

## Gate entry conditions (Refs #1944)

The four baton role transitions advance under explicit, validator-enforced entry conditions. Canonical specification lives in `instructions/role-baton-routing.instructions.md` §"Gate entry conditions — Admin and Consultant". Summary applicable to "complete this feature" requests:

- **Admin gate** (Collaborator → Admin): triggers when COLLABORATOR_HANDOFF is posted with all four signing fields plus per-AC verification PASS; role-label flips `role:collaborator → role:admin`; status-label flips `status:in-progress → status:testing`; preconditions enforced by `collaborator-handoff` + `test-discoverability` validators.
- **Consultant gate** (Admin → Consultant): triggers when ADMIN_HANDOFF is posted with signing + branch/commit/signer-independence fields; role-label flips `role:admin → role:consultant`; status-label flips `status:testing → status:review`; preconditions enforced by `admin-handoff` + `signer-fidelity` + `merge-evidence-pr-gate` validators plus signer-independence Admin-vs-Collaborator alias-difference check.
- **Close gate** (Consultant → done): triggers when CONSULTANT_CLOSEOUT carries verdict + rubric + anneal-tickets-filed + mid-flight-flaws blocks; role-label removed; status-label flips `status:review → status:done`; issue closes atomically; preconditions enforced by `consultant-closeout` validator and the merge-recorded admin_ops state.

Completion intent semantics are strict:
- "complete", "finish", or "ship" means terminal workflow delivery in one session when feasible once the active role identifies that intent in task scope.
- Do not pause after implementation to wait for another user nudge to run Admin or Consultant phases.
- Escalate only for blockers, missing evidence, or explicit design/UAT decisions.

## Admin completion contract (required before claiming done)

- Version collision check (Marketplace/tag/package alignment)
- Commit + push + PR creation with issue linkage
- CI green verification
- Merge
- Publish/release work (if applicable)
- Release integrity verification
- Issue closure comment with released version evidence
- **Runtime-deploy sync verification** (per #1105 D-006 / Codex Team CX-RD C8 HIGH-severity finding) — for changes that affect deployed runtime artifacts (`~/.copilot/`, `~/.codex/`, `~/.agents/skills/`), the closeout MUST include outputs of:
  - `npm run sync:codex` (Codex runtime parity)
  - `npm run sync:claude` (Claude Code runtime parity)
  - `npm run hamr:sync-verify` (HAMR substrate verification)

  If a change does NOT affect deployed runtime artifacts (e.g., wiki-only edits, research files), state explicitly: `sync-verification: N/A — change does not touch deployed runtime targets.`

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
