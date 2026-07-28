# Admin merge-before-handoff guardrail (Epic #3051)

Operator runbook for the guardrail that keeps the Admin baton role from deferring
its mandatory merge — closing the "role workflow can't finish without a human" gap.

## The predicate

For a `lane:code-change` ticket, `ADMIN_HANDOFF` is flagged with the
`admin-handoff-without-merge` violation when **all** hold:

- the linked PR is **CI-green** (required checks pass), and
- the `ADMIN_HANDOFF` carries `admin_review_rating: <N>` with **N ≥ 93**, and
- the PR is **not yet merged**.

The Admin must therefore merge the reviewed, green PR **before** emitting the
handoff. Implementation: `scripts/global/megalint/admin-merge-precondition.js`
(consumed by `scripts/global/megalint/admin-handoff.js`) plus the stop-hook
coupling in `hooks/scripts/stop_checks.py`.

## Carve-outs (require-not-bypass)

- **Red CI is never bypassed.** A genuinely RED required-CI PR is *not* flagged —
  the authoritative CI gate blocks it independently; this predicate never forces a
  merge over red CI.
- **Baseline-drift override** stays an explicit, labelled path (Epic #2517).
- **Merge-evidence-override** (`merge-evidence-override-approved`) satisfies the
  merge step, per the merge-evidence batch contract.
- **Deferred-final** (Epic #2295) is compatible — the predicate reads the actual
  `prMerged` fact.
- **Offline-graceful.** When merge/CI facts are unavailable (GitHub unreachable),
  the finding degrades to `severity: advisory`; the CI gate blocks when online.

## No client arbitration (#2578 / AC8)

Merge authorization is **never** routed to the client. Merge is the Admin baton
role's duty and issue-close is the Consultant's — both AI-agent roles. Asking the
client to authorize a routine, green, reviewed merge is a governance misalignment
(operator-identity contract: client = design + UAT only).

## Add-your-own admin_review_rating

Put `admin_review_rating: 95` (an integer ≥ 93 when you rate the PR mergeable) in
the `ADMIN_HANDOFF` body; the gate consumes it and the Consultant cross-checks it.
