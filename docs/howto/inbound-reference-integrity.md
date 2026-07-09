# Inbound-Reference Integrity (#3419, Epic #3398 C1)

`epic-close-readiness-check.js` answers *"are my children terminal?"* (**outbound**).
`inbound-reference-integrity` answers the complementary question at close/cancel time:
*"who still points **at** the ticket I'm closing, and is that pointer now dangling?"*
(**inbound**). Reference-rot is a measured ~23% class (research §3); a dangling
`merge into #N` (e.g. the #2093 pointer at cancelled #1899) is a real G1 hit.

## What it does

On `issues.closed` for `#N` it scans every live OPEN issue's title+body for the
reference-form catalog, tagged by drift class:

| Form | Class | Meaning |
|---|---|---|
| `merge into #N` / `fold into #N` | PB2 | `#N` was the designated merge survivor |
| `blocked by #N` / `blocks #N` | PB4 | dependency edge — cleared when `#N` closes, re-triage |
| `survivor: #N` / `canonical: #N` / `supersedes #N` | PB2 | survivor/canonical designation |
| `Refs Epic #N` / `Parent: #N` | PB2 | structural parentage |

On a hit it **routes the drift into the baton** (not report-only): files a
Manager-triage `type:correction` task (`Re-home orphaned reference to #N from #M…`),
posts a `BLOCKER_NOTE` on `#N`, and emits `incidents.jsonl`
`pattern_id: inbound-reference-orphan`. Idempotent — re-firing skips when the
correction task already exists.

## Boundaries

- **Deterministic $0** — regex over inbound bodies, no model call (the cross-model
  semantic-supersession lane is #3420).
- **Non-overlap with #3350** — `epic-close-readiness` is outbound children-terminal;
  this is the inbound sibling. Different edge direction, no duplication.
- **Advisory** — ships advisory; promotion to blocking is replay-eval-gated per the
  Epic #3398 model (never calendar-gated).

## Run manually

`workflow_dispatch` with `issue_number: <N>` re-scans a specific closed ticket.
Pure logic is unit-testable via `scripts/global/inbound-reference-integrity.js`
(`scanInbound`, `buildCorrectionTask`, `buildIncident`).
