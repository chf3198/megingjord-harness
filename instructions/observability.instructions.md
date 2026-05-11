# Observability Instructions

Canonical reference for harness + HAMR observability. Codifies decisions
from Epic #1339 (C1–C8). For evidence-signal-to-goal mapping, see
`wiki/concepts/harness-logging-inventory.md`.

## Logging surfaces

Eight known surfaces. Producer/consumer/schema/retention in inventory page.

- `~/.megingjord/incidents.jsonl` — anneal events (schema v2; v3-compatible)
- `~/.megingjord/cache-stats.jsonl` — HAMR cache hits
- `dashboard/events.jsonl` — baton transitions + hook emissions
- KV `substrate-health:latest` — HAMR health snapshot
- KV `cache-stats:hit-rate-7d` — HAMR cache aggregate
- `generated/anneal-sensor.json` — Goal Health Score snapshot
- `/tmp/governance-audit.json` — audit run snapshot
- HAMR Worker logs — Cloudflare runtime

## Schema standard

Use `scripts/global/event-schema-v3.js` for any new `*.jsonl` surface.
Required fields: `ts`, `version`, `service`, `env`, `event`. Recommended:
`trace_id`, `session_id`. Optional: `_summary` (≤200 chars, LLM-friendly).

OpenTelemetry GenAI `gen_ai.*` namespace recognized for LLM-step events
(per R&D Thread 1; `scripts/global/event-schema-v3.js` exports `isOtelGenAI`).

v1 events (no `version` field) and v2 anneal events upgrade-on-read.
Backward-compat preserved; no existing reader breaks.

## Retention + rotation

Per `scripts/global/log-rotation.js` (#1357). Default policy:

- `incidents.jsonl` — 90d hot + gzip archive
- `cache-stats.jsonl` — 30d hot, no archive
- `dashboard/events.jsonl` — 14d hot, no archive
- Snapshot files — replace-on-write (no rotation needed)

Trigger: size cap (50 MB) OR daily UTC boundary. Daily cron at 07:15 UTC.

## PII / secret redaction

**Prevent at instrumentation, not scrub at storage.** Use
`scripts/global/log-redaction.js` (#1358):

- `redactString(text)` for any free-text field before write
- `redactEvent(event)` recursive over nested object
- `wrapWrite(writeFn)` for instrumentation-site wrappers
- `sanitizeForLLM(fragment)` before including log content in any LLM prompt

Patterns in `config/redaction-patterns.json` (Anthropic/OpenAI keys, GitHub
PAT, AWS, JWT, Bearer, email, IPv4). Add new patterns by editing the JSON;
no code change required.

## Live-streaming + dashboard

SSE pipeline (per R&D Thread 3; `scripts/global/jsonl-tail.js` #1354 +
`scripts/sse-handler.js`). Three surfaces auto-streamed: events,
incidents, cache-stats. New panels use `subscribePanelSSE(eventType, cb)`
from `dashboard/js/panel-anim.js` (single shared EventSource).

Latency target: <500 ms p95 from file append to panel re-render.

## Animation + accessibility

Live panels animate on update via `animatePanelUpdate(element, className)`
(#1356). GPU-accelerated (opacity/transform/filter; no layout shift).
**`prefers-reduced-motion: reduce` is non-negotiable** — animations snap
to state in 400 ms instead of 1.6 s. WCAG 4.5:1 preserved by using
brightness + drop-shadow rather than color-only signaling.

## Goal-lens mapping (G1..G9)

Per `wiki/concepts/harness-logging-inventory.md` mapping table. Live view
at `/api/goal-coverage` + dashboard "Goal Coverage" panel (#1359). Status
classification: `ok` (≥3 signals / 7d), `low` (1–2), `gap` (0).

Known gaps as of Epic #1339 close: **none for surfaces with sensors**;
follow-up children can add sensors for new goals as harness evolves.

## Authority

Manager: defines surface contracts (instruction edits). Collaborator:
implements instrumentation. Admin: ensures gates pass. Consultant:
verifies goal coverage post-implementation. Per-event `trigger_role`
field records which role emitted (or `system` for sensor-driven).

## When in doubt

Read `wiki/concepts/harness-logging-inventory.md` for the surface map,
`research/harness-logging-rd-2026-05-11.md` for the R&D rationale, and
`research/logging-token-cost-benchmark-2026-05-11.md` for the
schema-cost trade-off analysis. Open a question against Epic #1339 if
something is missing or contradictory.
