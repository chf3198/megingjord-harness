# Gate disposal path (the missing half of promotion)

_Epic #3807 C3 (#3811). Tool: `scripts/global/gate-disposal-eval.js`._

The harness has always had a **promotion** path — an advisory validator promotes to blocking once its
replay-eval precision reaches the floor (≥ 0.85). It had **no disposal path**, so advisory validators
that never promoted sat advisory indefinitely: full maintenance cost, no protection (Epic #3807
mechanism 3). The disposal path is the symmetric other half — a way for a non-promoting or redundant
advisory validator to move **down** to a retirement-candidate so the governance surface can shrink.

## What the evaluator does

`node scripts/global/gate-disposal-eval.js` reads every advisory validator the
`governance-surface-census` reports and assigns each a disposition:

| Disposition | Trigger |
|---|---|
| `retirement-candidate` | a reviewed redundancy finding (property strictly dominated by a live **blocking** gate), OR replay precision below floor after ≥ N eligible windows (non-promoting) |
| `promotion-candidate` | replay precision ≥ floor (ready to become blocking) |
| `retain` | no positive evidence — the fail-safe default |

Flags: `--json` (machine list), `--candidates` (retirement-candidates only). Exit is always 0 — this is
an advisor, not a gate.

## Binding safety properties

- **Read-only.** The evaluator FLAGS candidates; it never deletes or edits a validator.
- **Fail-safe.** A validator is `retain` unless _positive_ evidence says otherwise. Missing replay data
  never produces a retirement-candidate.
- **Blocking gates are out of scope.** The evaluator only ever considers advisory validators. Retiring a
  live blocking control is the `security-policy-weakening` retained human touchpoint, never autonomous.
- **A candidate is a proposal, not a deletion.** The actual retirement runs the full
  Manager→Collaborator→Admin→Consultant baton and requires a cross-family `merge-consensus` receipt
  confirming no G1/G4 control is weakened (the MEASURE → CROSS-FAMILY-VERIFY → CUT protocol).

## The reviewed-redundancy registry

`REVIEWED_REDUNDANCY` in the tool is the evidence store for the redundancy basis — the disposal
counterpart to replay-eval results on the promotion side. Each entry is a measured, cross-family-
verifiable claim that an advisory validator's entire property is strictly dominated by one or more
**live blocking** gates. `liveDominators()` drops any dominator that no longer exists on disk, so a
stale entry can never manufacture phantom redundancy. Entries are retained after retirement as the
audit record of why the validator was removed and which gates now own its property.

## First retirement (the #3811 demonstration)

`worktree-naming-advisory.js` was an advisory-only branch-name warner. Both
`hooks/scripts/validate-branch-name.sh` (pre-commit) and `.github/workflows/branch-name.yml` (required
CI) already **reject** any non-conforming branch before it can land, so the advisory could never fire on
a branch that passed them; its one unique accepted shape (per-team-namespace `cc/fix/N-slug`) was itself
rejected by the blocking CI gate. Retiring it dropped the census `surface_units` by 1 and the advisory-
validator count from 26 to 25 with zero protective loss — the net-negative-surface contribution the
Epic's AC-E4 invariant requires.
