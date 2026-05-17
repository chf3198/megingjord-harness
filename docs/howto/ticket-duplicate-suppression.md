# Ticket duplicate suppression

`scripts/global/ticket-duplicate-guard.js` prevents the **Codex-filed-twice** pattern observed across #1700/#1701, #1697/#1698, #1600/#1601, #1602/#1603, #1608/#1619, #1609/#1621, #1625/#1626, #1691/#1692, #1677/#1678, #1682/#1683 — same actor, same title, seconds apart.

## Two modes

### Pre-create check

```bash
node scripts/global/ticket-duplicate-guard.js --check "Add new feature" --json
```

Returns `{ ok, matches, canonical }`. Exit 0 if no duplicate; exit 1 with `canonical` pointing at the existing issue if one exists. Wire into ticket-creation tooling before running `gh issue create`.

### Reconcile scan

```bash
npm run governance:duplicate-check          # default 10-minute window
npm run governance:duplicate-check -- --json
MEGINGJORD_DUPLICATE_WINDOW_MIN=30 npm run governance:duplicate-check
```

Scans all issues (open + closed) and flags same-title pairs created within the time window. Returns `{ ok, pairs, pattern_id, windowMin }`. `pattern_id: 1765-rapid-duplicate` for telemetry alignment.

## Normalization

Title comparison normalizes:

- Case (`Add Feature` matches `add feature`)
- Whitespace (`Add  feature` matches `Add feature`)
- Trailing punctuation (`Add feature!` matches `Add feature`)

## Time window

Default: 10 minutes. Configurable via `MEGINGJORD_DUPLICATE_WINDOW_MIN` env var. Window applies to creation-time delta; if both titles match AND `|created_a - created_b| ≤ window`, the pair is flagged.

## When a duplicate is detected

Pre-create: tooling should print the canonical issue number and either reuse it or abort the new create.

Reconcile: Manager closes the later-created issue with `status:cancelled` + `resolution:duplicate`, cross-linking the canonical (earlier) issue. See the cleanup pattern from #1606 follow-on work for the comment template.

## Limitations

- Same-actor-same-title-within-window only. Different-title near-duplicates (semantic match) are out of scope; use `governance:reconcile` for the broader issue-state audit.
- The pre-create check requires `gh` CLI access. For air-gapped runs, pass `--json` and consume the issue list from stdin (planned for v2).
- Window default of 10 minutes is generous; tighten via env var for tighter governance (e.g., `MEGINGJORD_DUPLICATE_WINDOW_MIN=2` for stricter idempotency).

## Tests

`tests/ticket-duplicate-guard.spec.js` (9 tests) covers normalization, window edges, title differentiation, check-mode positive/negative, scan-mode envelope, and CLI arg parsing. Run via `npm run governance:duplicate-check:test`.

## Related

- Closes #1765 (self-anneal: prevent rapid duplicate ticket creation).
- Memory pattern: `[[feedback-rapid-duplicate-ticket-creation]]` (operator-side awareness).
- Parent pattern source: #1700/#1701 cleanup observation.
