# Per-Repo Guardrail Overrides

How a repository operator adjusts harness guardrails for one repo **without editing the harness
source** — and, crucially, which controls can **never** be overridden. Contract designed in Epic #2892
(Phase-0 synthesis `research/override-contract-phase0-2892.md`).

## The three tiers

| Tier | Meaning | Override path |
|---|---|---|
| **Tier-H — hard-floor** | Security / provenance / privacy controls | **Never overridable** — no self-serve, no approval path |
| **Tier-A — overridable-with-audit** | Ceremony / process gates | Self-serve, but **logged + visible** (a subset needs `approved_by:`) |
| **Tier-C — freely-configurable** | Infra / availability toggles | Self-serve, no audit-block |

The hard-floor list is the versioned `config/override-hard-floor.json`. It currently protects:
signer-independence, cross-family consensus receipts, secret-scan, log-redaction,
credential-prompt-guard, prompt-injection defense, the merge-authority FSM, ticket-first provenance,
Team&Model signing, and the retained human touchpoints.

## Declaring overrides

Add a repo-local `.megingjord/overrides.yml` (or `.json`) — **not** in the harness source:

```yaml
overrides:
  doc_coverage_gate_advisory: true    # Tier-A — relax doc-coverage for this repo (audited)
  hamr_disabled: true                 # Tier-C — this repo has no HAMR substrate
```

- A **Tier-H key is rejected** by `scripts/global/megalint/override-contract.js` (fail-closed — if the
  hard-floor config is unreadable, *all* overrides are rejected). The required CI workflow
  `override-contract.yml` enforces this on every PR.
- `scripts/global/override-resolver.js` resolves the effective Tier-A/C map, enumerates a repo's
  **active overrides** (`activeOverrides()`), and emits a **redacted** schema-v3 `override-applied`
  event per active override to `dashboard/events.jsonl` (`auditOverrides()`) — so every active
  override is visible and auditable (G8), with no secret values leaked (G4).

## Why the hard-floor exists

Making a security/provenance control self-serve-overridable would let any repo quietly weaken the
harness — the exact "security-weakening" carve-out the operator-autonomy contract reserves for the
client. The hard-floor makes that **impossible by construction**: a request to override a Tier-H
control is not a config change, it is a security-policy decision that must be escalated, never
self-served. This contract only *bounds and audits* the overrides that already existed; it adds no
new bypass surface.
