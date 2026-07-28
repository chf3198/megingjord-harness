# Phase-0 Synthesis — Per-Repo Guardrail Override Contract (Epic #2892)

> **Epic:** #2892 · **Phase-0 child:** #3845 · **Date:** 2026-07-22
> **Lane:** `lane:docs-research` · **Strategy:** `peer-review`
> **Signed-by:** Nova Mason · **Team&Model:** claude-code:claude@local · **Role:** manager

## Executive summary

The Epic's premise ("no override mechanism exists → guardrails are one-size-fits-all") has **drifted**:
a **de-facto override sprawl already exists** — ~40+ `MEGINGJORD_*` env flags, `*_BYPASS`/`*_DISABLED`/
`*_GATE_ADVISORY` toggles, `config/authorization-profiles.json`, the `.github/copilot-instructions.md`
local override, label bypasses, and `config/flag-lifecycle.json`. What is missing is not *a* mechanism
but **coordination**: no unified per-repo contract, no explicit **G1/G4 hard-floor** of controls that
must NEVER be overridable, and no consolidated **audit** of a repo's active overrides. So the correct
Phase-0 deliverable is to **inventory + classify + bound** the sprawl — a **net-positive tightening**
(it adds a floor that *defends* the security-weakening carve-out), not a new weakening surface (which
would violate the #3807 net-negative principle).

The dependency (Epic #2891 guardrails assessment) is **satisfied** (closed, 10 children #2903-#2912).

## Inventory (the existing override surfaces)

| Surface | Kind | Examples | Governs |
|---|---|---|---|
| Env flags | runtime toggle | `PHASE0_GATE_BYPASS`, `SKIP_CLOSEOUT_PREFLIGHT`, `PUSH_GATES_BYPASS`, `TEST_FLOOR_DISABLED`, `DOC_COVERAGE_GATE_ADVISORY`, `EPIC_CLOSE_OVERRIDE`, `LEGACY_DOC_SKIP`, `MEGINGJORD_IT_OPS` | relax a gate for one run |
| Env flags (infra) | availability | `MEGINGJORD_HAMR_DISABLED`, `MEGINGJORD_MCP_DISABLED`, `MEGINGJORD_NO_DOTENV`, `MEGINGJORD_QUIET_RESOLVER` | turn off a substrate/feature |
| Config policy | declarative | `config/authorization-profiles.json` (#2910), `config/flag-lifecycle.json` (#3795), thresholds/hosts | per-context policy |
| Labels | per-ticket | `merge-bypass:admin-exception`, `governance:close-without-merge`, `baseline_drift_override` | audited one-off exception |
| Local instructions | per-repo | `.github/copilot-instructions.md` (local wins) | override instruction prose |

## The 3-tier classification (the contract's core)

### Tier H — HARD-FLOOR (NEVER overridable, no approval path exists)
Provenance + security + privacy controls. A per-repo override that would disable ANY of these is
**rejected** by the contract validator — there is no self-serve OR approval path. This tier is the
key net-positive addition (defends C-G1/C-G4):
- signer-independence + cross-family consensus receipts (`baton-independence`, `signer-fidelity`)
- secret-scan / redaction (wiki + marketplace + log redaction)
- credential-prompt-guard (never ask the client for a locally-available secret)
- prompt-injection defense on Read/Fetch returns (#2905)
- the merge-authority FSM (`baton-authority/merge`) — merge/close authority is not self-granted
- ticket-first + `Refs #N` provenance; canonical Team&Model signing
- the 4 retained human touchpoints (`config/retained-human-touchpoints.json`)

### Tier A — OVERRIDABLE-WITH-AUDIT (self-serve, but logged + visible; some need an approval marker)
Ceremony/process gates whose relaxation does not weaken a security/provenance control. Already have
audited escape hatches; the contract *unifies* them under one declarative surface + mandatory G8 audit:
- `DOC_COVERAGE_GATE_ADVISORY`, `TEST_FLOOR_DISABLED`, `SKIP_CLOSEOUT_PREFLIGHT`, `PUSH_GATES_BYPASS`,
  `LEGACY_DOC_SKIP`, `EPIC_CLOSE_OVERRIDE`, `PHASE0_GATE_BYPASS` (already audited), `MEGINGJORD_IT_OPS`,
  canonical-main-RO relaxation, cross-family-preflight-not-required (research-only repo, per the Epic's example).
- **Approval marker** required for the highest-consequence (a repo-config `approved_by:` + a committed
  rationale) on: `PHASE0_GATE_BYPASS`, canonical-main-RO relaxation. The rest are self-serve + audit.

### Tier C — FREELY-CONFIGURABLE (self-serve, no audit-block — pure infra/availability)
No governance-weakening effect; these are settings, not bypasses:
- `MEGINGJORD_HAMR_DISABLED`, `MEGINGJORD_MCP_DISABLED`, `MEGINGJORD_NO_DOTENV`,
  `MEGINGJORD_QUIET_RESOLVER`, fleet hosts/models, thresholds/SLOs.

## AC answers

- **AC-R1 (right surface):** a single declarative per-repo file **`.megingjord/overrides.yml`** (repo-local,
  not harness source) resolving Tier A + Tier C keys only; env flags remain the transient/CI escape hatch
  but are *mirrored* into the audit. Instruction-prose overrides stay in `.github/copilot-instructions.md`.
- **AC-R2 (hard-floor):** the explicit Tier-H list above, versioned in `config/override-hard-floor.json`;
  the contract validator rejects any Tier-H key appearing in a repo override (fail-closed).
- **AC-R3 (drift on update):** overrides are declarative keys checked against `config/flag-lifecycle.json`;
  an unknown/retired key warns (never silently ignored); the hard-floor list is versioned + a census diff
  flags newly-added overridable surfaces that lack a tier classification.
- **AC-R4 (audit / G8):** every active override is enumerated by extending `governance-surface-census.js`
  (which already counts `bypass_flags`) to emit the repo's active Tier-A/Tier-C set; each Tier-A use emits
  a redacted `override-applied` event (schema-v3) to `dashboard/events.jsonl`.
- **AC-R5 (approval vs self-serve):** Tier-C self-serve; Tier-A self-serve + mandatory audit (subset needs
  an `approved_by:` marker); Tier-H never (no path).

## AC-R6 — Cross-family council verdict

| Family | Model | Score | Verdict |
|---|---|---|---|
| mistral | mistral-large-latest | 98 | PASS |
| meta | llama-3.3-70b @groq | 96 | PASS |
| deepseek | deepseek-v4-flash @nvidia | 98 | PASS |

**median 98, min 96, 3 disjoint families, Gwet AC1 = 1.0** (chance-corrected). Verified `kind:review`
receipt `05d025333e5c1886` in `governance/cross-family-consensus.jsonl` (meta + mistral PASS). **VERDICT: PASS.**

## Phase-1 slate (materialized as children; net-positive TIGHTENING only)
1. **P1-a — `config/override-hard-floor.json` + `override-contract` validator** that rejects any repo
   override touching a Tier-H control (fail-closed). Reversible, autonomous, net-positive.
2. **P1-b — `.megingjord/overrides.yml` resolver + G8 audit** (census enumerates active overrides; Tier-A
   use emits an event). Reversible, autonomous.
3. **P1-c — docs:** promote the tier taxonomy into `instructions/` + a `docs/howto/repo-overrides.md` operator guide.

## Recommendation
Ship the **hard-floor + contract** (P1-a) first — it is pure governance tightening (prevents self-serve
weakening of security controls) and consolidates real drift. Do NOT add any new *weakening* bypass; the
contract only *bounds and audits* what already exists. Any future request to make a Tier-H control
overridable is a **security-weakening carve-out** → escalate, never self-serve.
