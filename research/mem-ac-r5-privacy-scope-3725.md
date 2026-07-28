---
title: "AC-R5 — Privacy & scope model (G4 hard constraint)"
ticket: 3725
epic: 3724
lane: docs-research
ac: AC-R5
last_updated: 2026-07-10
status: ratified
cross_family_receipt: de59126fdf90bcfb
related:
  - "[[mem-surface-inventory-3725]]"
  - "[[mem-ac-r7-write-path-3725]]"
---

# AC-R5 — Privacy & scope model (G4 hard constraint)

## Question
Formalize the three storage/privacy tiers (repo-committed / user-global mirror / workspace-private) + A4 namespace isolation as a **first-class** design. **May not weaken** redaction or cross-project isolation.

## As-is (the tiers emerged implicitly)
| Tier | Location | Committed | Private | Isolation rule |
|---|---|---|---|---|
| **T1 repo-committed** | `wiki/` A/B/C | yes → `main` | no (log-redacted) | `wisdom/project` never distributed (A4) |
| **T2 user-global mirror** | `~/.copilot/wiki/` | derived RO mirror of `wisdom/global/` | no | read-only from non-Megingjord repos |
| **T3 workspace-private** | `~/.claude/projects/<ws>/memory/` + `MEMORY.md` | gitignored / out-of-repo | **yes** | per-workspace, machine-local |

Existing invariants (must not weaken): **log-redaction** (`log-redaction.js`, prevent-at-instrumentation, `config/redaction-patterns.json`), **A4 namespace isolation** (`wisdom/project` never distributed; cross-wiki links need explicit prefix + `related:` justification), the write-router's per-fact `private` flag, and the credential-prompt-guard (never re-expose a local secret).

## SOTA evidence (validates the model, doesn't replace it)
- **File-native tiering maps 1:1** to the documented Claude Code memory scopes: managed-policy / user (`~/.claude/CLAUDE.md`) / project (committed) / **local (`CLAUDE.local.md`, gitignored)**. Auto-memory `<project>` is **derived from the git repo**, so project facts don't bleed cross-project — native namespace isolation, mirroring A4.
- **Mem0 privacy practices** (vendor, partially unaudited): an **input-sanitization stage** scanning for PII/credentials/API-keys with redact/reject, **per-user namespaces with strict access boundaries**, GDPR erasure alignment. Confirms the harness's prevent-at-write redaction posture is the right shape.
- No formal cross-industry standard for per-record memory **visibility metadata** was found — so a harness-local `scope`/`visibility` frontmatter is the correct instrument.

## Decision (recommended — additive, never weakening)
1. **Make the three tiers a named, documented contract** (`memory-privacy-tiers.md`), each record carrying explicit **`tier:` (`repo-committed | user-global | workspace-private`)** + **`visibility:` (`public | user | private`)** frontmatter, derived from the `memory-write-router.js` `private` flag (which already encodes it). Relabel, don't re-home (AC-R1 consistency).
2. **Promotion is a one-way, fail-closed lattice:** `workspace-private → user-global → repo-committed` is a **deliberate, redaction-gated** step; the reverse never happens automatically. A record's `scope`/`visibility` can only **narrow** by default; widening requires an explicit, logged promotion that re-runs redaction (the operator-memory-promotion audit #2413 pattern).
3. **A4 hard invariant restated & enforced:** `wisdom/project` and `workspace-private` are **never** distributed to T2/global; consolidation (AC-R3) inherits the **most-restrictive** source scope (fail-closed). A `scope-isolation-lint` asserts no project/private record is reachable from a global/committed page.
4. **Redaction is a promotion gate, not a storage scrub:** any promotion into a committed/mirrored tier runs `log-redaction.js` first; a redaction miss **blocks** promotion (G4 fail-closed).
5. **Write-path coupling (AC-R7):** T1 durability must not require weakening branch protection — the mirror lands on a non-protected branch, not via a bypass actor (the bypass-actor path is the **G4 security carve-out** routed to the client).

## Non-negotiables (this AC may not propose)
- No weakening of redaction, A4 isolation, or the private/global split. No auto-promotion of private → public. No secret in a committed/mirrored artifact.

## PANEL SUMMARY
"Formalize the three memory tiers (repo-committed / user-global / workspace-private) as a named contract with explicit `tier:`+`visibility:` frontmatter derived from the existing write-router `private` flag; make cross-tier promotion a ONE-WAY, redaction-gated, fail-closed lattice (scope may only narrow by default; widening requires an explicit logged promotion that re-runs redaction and BLOCKS on a miss); restate A4 isolation as a hard invariant with a `scope-isolation-lint` and most-restrictive-scope inheritance for consolidation; and keep durability off any branch-protection-weakening path (bypass actor = client carve-out). Additive only — redaction, A4 isolation, and the private/global split are NOT weakened. Sound and safe?"

## Decision log (G8)
- 2026-07-10 — Recommend named tier contract + one-way redaction-gated promotion lattice + scope-isolation-lint. G4 hard-constraint honoured (additive, fail-closed). Cross-family panel: receipt above / #3725 comment.
