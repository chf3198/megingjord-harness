# Accountable-Team Schema (Epic #2345)

Persistent accountability ownership, kept distinct from the transient baton
role label. Approved design: synthesis on issue #2346; ratifies ADR-010 +
role-baton-routing v2.0 and adds the one residual piece below.

## Why

`role:*` historically overloaded two ideas: who is *answerable* for a ticket
(persistent) and who is *acting now* (transient). On backlog/terminal tickets
that overload produced ambiguous board and audit semantics. The
`accountable-team:*` label separates the two cleanly.

## The label

`accountable-team:<team>` where `<team>` is one of `claude-code`, `copilot`,
`codex`, `antigravity`.

- Persists across **all** states, including terminal — unlike `role:*`, which
  is present only on active, role-owned states.
- Never shares a namespace with `role:*`, so it coexists with closed tickets
  without re-introducing an execution-role label. `label-lint` is namespace-
  scoped (it inspects only `role:`/`status:`), so no label-lint change is needed.
- `area:*` (domain) and the immutable per-action `Signed-by` / `Team&Model` /
  `Role` audit trail remain unchanged and complement this label.

## Resolution order

"Who is accountable for ticket N?" resolves as:

1. the `accountable-team:*` label, if present; else
2. the team in the most recent baton/closeout signing block; else
3. the default manager team-of-record (`claude-code`).

Implemented by `resolveAccountableTeam(labels, comments)` in
`scripts/global/accountable-team.js`.

## Authority

Only the **Manager** or **Admin** role may set or change `accountable-team:*`,
and never as a side effect of a baton transition (it is decoupled from role
flips). See `canModifyAccountableTeam(role)`.

## Migration / backfill

`scripts/global/accountable-team-backfill.js` derives the label for tickets that
lack one, from each ticket's latest signing block.

```bash
node scripts/global/accountable-team-backfill.js            # dry-run (default)
node scripts/global/accountable-team-backfill.js --apply    # write labels
```

It is idempotent (already-tagged tickets are skipped) and additive, so rollback
is simply removing the labels the run added (printed in the dry-run plan).

## Tests

`tests/accountable-team.spec.js` covers the resolution order, the authority
rule, and backfill derivation/idempotence (`node --test`).
