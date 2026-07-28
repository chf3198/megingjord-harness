# Cross-Family Consensus as Signer Independence (#3532)

## The problem it closes

The Admin-merge signer-independence gate used to compare the **`Signed-by:` persona string** of
`ADMIN_HANDOFF` vs `COLLABORATOR_HANDOFF`. Because `agent-signature.js` deterministically mints a
*different surname for the same team* (e.g. `claude-code:claude-opus` → collaborator "Orla Harper",
admin "Orla Reyes"), **one agent could satisfy the two-party gate alone** by signing both roles.
Precedent: #3518/#3521. The stricter control lived *outside* the harness (Claude Code's auto-mode
classifier); the harness now enforces it natively.

## The contract (Client design decision)

Signer-independence **PASSES iff**:

- **(a) Different signing team** — `ADMIN_HANDOFF` and `COLLABORATOR_HANDOFF` sign under different
  `Team&Model` **TEAM segments** (e.g. `codex:*` ≠ `claude-code:*`); **or**
- **(b) Verified cross-family consensus receipt** — the `ADMIN_HANDOFF` cites a
  `cross_family_receipt:` that a CI validator can re-verify from committed evidence.

A **same-team persona-split with no valid receipt FAILS.** Persona-surname difference alone is not
independence.

## Why the receipt is un-forgeable (and its honest boundary)

`npm run consensus:panel -- --ticket N --summary "<change>"`:

1. Selects **≥2 providers of distinct model families**, none equal to the authoring family
   (claude-code → `anthropic`), from the `$0` free-cloud fleet (`free-cloud-dispatch.js`).
2. Each panelist independently votes `VERDICT: PASS` or `VERDICT: REJECT` (an unparseable answer
   is treated as REJECT — fail-safe).
3. Their **actual responses** are appended to the **append-only, hash-chained** ledger
   `governance/cross-family-consensus.jsonl` (`chain = sha256(prev_chain + entry)`), committed to
   the PR so CI can read it.
4. The receipt is `sha256` over the ordered ledger entries for that ticket (16-hex prefix).

`consensus-receipt-check.js` (wired into `baton-authority-merge.yml`, and consumed by the
`SIGNER_INDEPENDENT` evidence bit) re-verifies: **chain integrity → sha256 match → ≥2 distinct
families all ≠ authoring family → unanimous PASS**. Selective ledger edits break the chain and are
rejected; the responses are stored for human/CI audit.

**Residual boundary (documented, not hidden):** the hash-chain proves the receipt binds to the
logged responses and makes tampering detectable, but genuine-ness ultimately rests on those
responses being *real provider outputs*. A whole-chain forgery (fabricating responses *and*
recomputing every chain link) is not cryptographically prevented here — that needs provider-side
crypto provenance (a follow-on, mirroring the `cross-team-response-fidelity` residual gap). The bar
is nonetheless raised from "any 16-hex string passes" to "≥2 real non-authoring-family votes,
audited and CI-re-verifiable."

## Operator quickstart (single-agent baton)

```bash
npm run consensus:panel -- --ticket N --summary "one-line change description"
# → prints { ok, receipt, families, panel }. On ok:true, put the receipt in ADMIN_HANDOFF:
#     cross_family_receipt: <16hex>
# commit governance/cross-family-consensus.jsonl with the baton artifacts.
npm run consensus:receipt-check   # ISSUE_NUMBER=N — same check CI runs
```

## Reconciliation with the collaborator receipt (#2904)

Both receipts share one algorithm/format (`cross-family-receipt.js`, `RECEIPT_FIELD_RE`), one
ledger, two `kind`s: `review` (collaborator preflight, #2904) and `merge-consensus` (this Admin
authorization path).

## Shift-left ledger verification of the collaborator receipt (#3678, F1 · Epic #3679)

A cited `cross_family_receipt` on a COLLABORATOR_HANDOFF is now **ledger-verified at handoff-emission
time**, not merely format-checked. The gate (`megalint/collaborator-handoff.js`) and the local
self-check (`collaborator-handoff-schema.js`) share one rule, `receiptLedgerViolation`, which fails
closed when the cited receipt is not `computeReceipt()` of a genuine ≥2-family ledger slice
(`cross-family-receipt-unledgered`) or when the ledger chain is tampered
(`cross-family-receipt-ledger-tampered`). This closes the root F1 hole from #3673 / PR #3677, where a
fabricated 16-hex receipt passed the collaborator gate and was caught only later at merge. The full
≥2-distinct-family / unanimous-PASS verification remains at the merge gate (`consensus-receipt-check.js`)
as defense-in-depth; the shift-left check proves the receipt is *real*, the merge gate proves it is
*sufficient*.
