# Governance chains: the unbreakable-link invariant and how to add one

Epic #2709 establishes a single invariant for the harness:

> **No governance-critical link may depend on operator discretion.** Every link in a
> governance chain MUST be machine-guaranteed - either **auto-emitted** by a hook on the
> triggering event, or **fail-closed** by a guard that blocks forward progress until the
> link exists. "The operator is trusted to remember" is never a valid link type.

## The pieces (all shipped under Epic #2709)

| Component | File | Role |
|---|---|---|
| Registry | `config/governance-chains.yml` | declares every chain's links + `guarantee` |
| Meta-validator | `scripts/global/megalint/chain-integrity.js` (#2721) | CI gate: rejects discretionary links, phantom enforcement points, weakening |
| Derivations | `scripts/global/chain-derivations.js` (#2722) | auto-emit `active_ticket` / `admin_ops` / stale-advisory clears |
| Outbox | `scripts/global/governance-outbox.js` (#2724) | offline fail-closed + auto-queue durability |
| Bypass guard | `hooks/scripts/pretool_guard.py` (#2706) | pre-flight fail-closed admin-override exception |
| Judgment gates | `scripts/global/judgment-gate.js` (#2723) | flaw-decision + baton-entry fail-closed logic |
| Authoring + health | `scripts/global/gov-check.js`, `gov-scaffold-link.js` (#2725) | shift-left check + guided scaffold |

## How to add a new governed link

1. **Scaffold** a compliant stub (the tool refuses `operator-discretionary`):

   ```
   node scripts/global/gov-scaffold-link.js --chain my-chain --link my-link \
     --guarantee enforced --enforcement-point scripts/global/my-guard.js
   ```

2. **Declare** it: paste the emitted entry into `config/governance-chains.yml` under
   `chains:`, and implement the guard at the declared `enforcement_point`.

3. **Check locally** (the same verdict CI gives - shift-left):

   ```
   node scripts/global/gov-check.js          # human-readable
   node scripts/global/gov-check.js --json   # chain-health for a dashboard
   ```

4. **CI confirms** fail-closed: `chain-integrity.js` blocks the merge if the link is
   discretionary, its `enforcement_point` does not resolve, or a governed-surface file
   changed without a registry delta.

## Choosing the guarantee

- **auto-emitted** - the system can synthesize the link from observable facts (a branch
  name, git/PR state, a closed+merged issue). Prefer this; the operator does nothing.
- **fail-closed** - the link needs an operator judgment the system cannot synthesize
  (a flaw decision, an emergency-bypass reason). Block until it is recorded; a recorded
  human override is compliant - only a *silent* one is forbidden.

See also: `docs/howto/pre-push-gates.md`, `instructions/workflow-resilience.instructions.md`.
