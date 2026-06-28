# Epic #1298 — Cross-Team Synthesis Decision
Date: 2026-05-12

## Summary Table
| Decision | Outcome |
|---|---|
| Substrate reuse vs greenfield | Reuse existing harness Ed25519 path |
| Key storage | Local keyring (`~/.megingjord/keys/governance`) in phase-1 |
| Rotation policy | Quarterly + incident rotate; dual-key grace window |
| Human-readable compatibility | Preserve existing `Signed-by`/`Team&Model`/`Role`, append `Crypto-*` |

## Detailed Findings (with source links)
- Team plans: [CC plan](epic-1298-cc-rd-plan-2026-05-12.md), [CP plan](epic-1298-cp-rd-plan-2026-05-12.md), [CX plan](epic-1298-cx-rd-plan-2026-05-12.md).
- Implementation landed:
  - [scripts/global/governance-artifact-signature.js](scripts/global/governance-artifact-signature.js)
  - [scripts/global/agent-signature.js](scripts/global/agent-signature.js)
  - [scripts/global/megalint/manager-handoff.js](scripts/global/megalint/manager-handoff.js)
  - [scripts/global/megalint/consultant-closeout.js](scripts/global/megalint/consultant-closeout.js)
  - [inventory/team-model-signatures.json](inventory/team-model-signatures.json)

## Last-updated
2026-05-12T00:00:00Z

## Actionable Next Steps
1. Add KMS-backed key provider for phase-2 hardening.
2. Wire crypto checks into collaborator/admin validators in a follow-on ticket.
3. Add CI smoke job that signs + verifies a synthetic baton artifact each run.

Signed-by: Caden Mason
Team&Model: codex:gpt-5.3-codex@codex-cli
Role: manager
