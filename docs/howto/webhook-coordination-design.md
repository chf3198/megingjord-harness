# Cross-Team Webhook + Polling Coordination Design

Real-time cross-team event delivery via GitHub webhooks +
`repository_dispatch` + `workflow_dispatch`, with mandatory polling fallback
for operators without webhook-receive capability.

## Three delivery surfaces

| Surface | Direction | Reach | Latency | Operator requirement |
|---|---|---|---|---|
| `repository_dispatch` | push-send | All operators with `repo` scope | Seconds | None beyond GitHub access |
| `workflow_dispatch` | manual push-send | All operators with `actions:write` | Seconds | None beyond GitHub access |
| Webhook receive | push-receive | Operators with public endpoint OR Actions-hosted runner | Sub-second | Public URL or Actions runner |
| Polling | pull | All operators | Configurable (default 60s) | None |

## AC1 decision (this ship)

**Recommended surface**: GitHub-hosted Actions runner accepting
`repository_dispatch` events. Reasons:

- No external receiver infrastructure required (zero new resources).
- Operators inherit existing Actions credentials.
- Per #1628 G5 portability: classified as integral for *push-send + polling-
  receive*; classified as opt-in for *push-receive via external tunnel*.

Air-gapped operators continue with polling-only coordination at a longer
interval (default 60s; configurable via `MEGINGJORD_POLL_INTERVAL_SECONDS`).

## Polling-fallback contract (mandatory per G5)

- Default interval: 60s.
- Backoff on rate-limit signal from GitHub API.
- Reads the same Projects v2 board state surface (#1630) — claim deltas
  are visible whether they arrived via webhook or were polled.
- Opt-in faster intervals via `MEGINGJORD_POLL_INTERVAL_SECONDS=15` (caps at 5s).

## Event types of interest

| Event | Webhook payload | Polling proxy |
|---|---|---|
| Issue label change | `issues.labeled` | `gh issue view N --json labels` |
| Issue closure | `issues.closed` | `state: CLOSED` poll |
| PR open | `pull_request.opened` | `gh pr list --state open` |
| PR merge | `pull_request.closed` (merged=true) | `mergedAt` poll |
| Comment | `issue_comment.created` | `gh issue view N --json comments` |
| Projects v2 field change | `projects_v2_item.edited` | GraphQL board poll |

## Authentication

- Webhook receiver: HMAC-SHA256 with `MEGINGJORD_WEBHOOK_SECRET`.
- Polling: standard `GITHUB_TOKEN` (same as `gh` CLI).

## Implementation children

- AC2 (cross-team-event-listener.js helper): follow-on.
- AC3 (Actions-hosted receiver workflow): follow-on.
- AC4 (polling-fallback library): follow-on.
- AC5 (event-to-board write-through): follow-on.
- AC6 (tests): follow-on.

## Composition with #1630

The polling surface and webhook surface both read/write the same Projects v2
board state. Webhook arrival just makes the change visible sooner.

## Related

- #1632 — parent (this design)
- #1630 — Projects v2 board (#1624 F2)
- #1628 — G5 Portability contract
- #1624 — research source (F4)
- `instructions/harness-goals.instructions.md` G5 (opt-in vs fallback)
