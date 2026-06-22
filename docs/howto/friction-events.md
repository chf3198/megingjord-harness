# Friction events (structured anneal feedstock)

A **friction** is any harness pothole an operator hits mid-flight: a gate false-block, a
workaround, a retry, a fleet timeout. Historically these were captured ad hoc in prose (e.g.
the Cursor Team's 18-item manual log on Epic #3008) or lost entirely, so cross-team recurrence
went undetected — Cursor (#3008) and Claude Code (#3095) independently hit the *same* potholes
in one week. `#3165` standardizes a structured friction-event stream so recurrence is detected
automatically.

## Emit a friction at the moment it happens

Friction events are written to `~/.megingjord/incidents.jsonl` as schema-v3 events tagged
`tier: 1`, keyed by a stable `pattern_id`, so the existing `anneal-tier2-autofile` recurrence
model consumes them with no extra plumbing.

**JavaScript** (`scripts/global/friction-event.js`):

```js
const { emitFriction } = require('./friction-event');
emitFriction('worktree-push-gate-commit-desync', {
  team: 'claude-code', runtime: 'claude-code', role: 'admin',
  surface: 'hooks/scripts/pretool_guard.py', severity: 'medium',
  workaround: 'deleted remote ref via gh api',
});
```

**Python** (`hooks/scripts/friction_event.py`):

```python
from friction_event import emit_friction
emit_friction('canonical-main-enforcer-redirect-false-block', {
    'team': 'claude-code', 'runtime': 'claude-code', 'role': 'collaborator',
    'surface': 'hooks/scripts/canonical_main_enforcer.py', 'severity': 'low',
    'workaround': 'used the Write tool instead of a > redirect',
})
```

## Schema

| Field | Required | Notes |
|---|---|---|
| `pattern_id` | yes | stable id; see the seed catalog below |
| `severity` | yes | `low` \| `medium` \| `high` \| `critical` (defaults to `low`) |
| `tier` | yes (set to `1`) | makes the event visible to the recurrence detector |
| `team`, `runtime`, `role`, `surface` | recommended | who hit it and where |
| `workaround` | recommended | what unblocked it |
| `cost` | optional | cycles/tokens spent |

Both emitters **redact** secret-bearing strings at the instrumentation site (G4) — JS via
`log-redaction.js`, Python via the mirrored pattern set (same approach as
`baton_event_emitter.py`). Emission never raises; it is best-effort observability.

## Recurrence routing (cross-team weighted)

`anneal-tier2-autofile` already promotes any `tier:1` pattern at **count ≥ 2** to a Tier-2
anneal proposal. `friction-recurrence.js` adds **cross-team weighting**: a friction pattern
observed by **≥ 2 distinct teams** is bumped one severity level (escalates faster than the same
count from a single team). The weighting is additive — only friction candidates are touched;
ordinary anneal candidates pass through unchanged.

## Seed catalog

`config/friction-pattern-catalog.json` documents confirmed `pattern_id`s (surface, description,
first-seen teams, refs). The catalog is documentation, not a gate — a new `pattern_id` may be
emitted before it is catalogued. Seed ids include `preflight-full-suite`, `fleet-32b-timeout`,
`worktree-push-gate-commit-desync`, `closeout-pre-push-chicken-egg`, and the session-confirmed
`push-gate-branch-delete-false-block`, `canonical-main-enforcer-redirect-false-block`,
`push-gate-heredoc-git-push-false-block`, `sync-direction-reverse-trap`, and
`test-evidence-tdd-pyramid-no-pytest`.

## Rollout

Advisory-first. Promotion of the recurrence routing from advisory to a blocking signal is
**replay-eval-gated** (precision ≥ 0.85 against the historical incident corpus), never
calendar-gated — consistent with the harness's replay-over-soak model.

## Tests

- `tests/friction-event.spec.js` — JS schema, emit/redaction, recurrence + cross-team weighting (`node --test`).
- `tests/hooks/test_friction_event.py` — Python parity (`python3 -m unittest`).
