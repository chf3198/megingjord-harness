# Cross-Orchestrator Compatibility Suite

## Purpose

`tests/orchestrator-compatibility.spec.js` is a portable Node test that any AI Agent Orchestrator (Claude Code, Codex, Copilot, Antigravity, future entrants) can execute to self-verify its harness recognition across six required surfaces.

## Surfaces verified

| Surface | What it checks |
|---|---|
| `signer-registry` | Entry in `inventory/team-model-signatures.json` `registry` array with the orchestrator's team string |
| `routing-runtimeKinds` | Inclusion in `scripts/global/routing-provider-adapters.json` `runtimeKinds` array |
| `deploy-target` | Recognition in `scripts/deploy.sh` target regex |
| `plugin-manifest` | Canonical plugin manifest path in `scripts/validate-plugin-compat.js` (Codex marked not-applicable; no plugin convention) |
| `dashboard-vendor` | Entry in `dashboard/js/multi-agent-sessions.js` `VENDOR_ICONS` map |
| `parity-inventory` | Inclusion in `inventory/orchestrator-governance-parity.json` `runtimes` array |

## Usage

Single-orchestrator mode (assert a specific orchestrator is recognized everywhere applicable):

```
ORCHESTRATOR=antigravity node --test tests/orchestrator-compatibility.spec.js
```

All-orchestrators parity-matrix mode (default; reports for all four known runtimes):

```
node --test tests/orchestrator-compatibility.spec.js
```

The suite emits a JSON parity report to `~/.megingjord/orchestrator-parity-<timestamp>.json` containing per-orchestrator per-surface recognition status with evidence strings.

## Adding a new orchestrator

To onboard a new orchestrator, ship one ticket per non-recognized surface:

1. `signer-registry`: PR adding a `registry` entry to `inventory/team-model-signatures.json`
2. `routing-runtimeKinds`: PR adding the team string to `runtimeKinds` array
3. `deploy-target`: PR adding the target to `scripts/deploy.sh` regex + `package.json` `deploy:<name>` scripts
4. `plugin-manifest`: optional path addition to `scripts/validate-plugin-compat.js` (skip if no plugin convention)
5. `dashboard-vendor`: PR adding to `VENDOR_ICONS` + `VENDOR_COLORS` + CSS class
6. `parity-inventory`: PR adding to `inventory/orchestrator-governance-parity.json` `runtimes` array

After each PR ships, re-run the suite to verify the surface flips from not-recognized to recognized. The Antigravity 100%-parity sequence (PRs #2364 #2368 #2378 #2381 #2367) is the worked example.

## CI integration

Optional: add a CI job that runs the suite on every PR and posts the parity report as a comment. This is a Phase-2 enhancement; out of scope for this initial landing.

## Maintenance contract (Q7)

When a NEW orchestrator-recognition surface is added to the harness, the contributor MUST add a corresponding surface entry to the SURFACES map in `tests/orchestrator-compatibility.spec.js`. The suite is the source of truth for "what surfaces require per-orchestrator registration"; a surface that lives outside the suite is effectively invisible to compatibility verification. Reviewers should flag any PR that adds a per-orchestrator switch (e.g. `if (orch === 'antigravity')`) without a corresponding SURFACES entry.

## Q4 abuse-prevention contract

A surface marked `applicable: false` for an orchestrator MUST carry a non-empty `evidence` string explaining WHY the surface does not apply. A meta-test asserts this contract. Codex+plugin-manifest is the canonical example: `applicable: false, evidence: 'orchestrator has no canonical plugin convention; surface not applicable'`. The escape hatch exists for genuine architectural differences, not to hide real gaps.

Refs Epic #2362 · Refs #2360 round-4 §3 surfaces enumeration
