# Research: Dashboard HAMR opt-in UX + dynamic fleet team discovery

**Ticket**: #967 (Epic #966)
**Lane**: docs-research
**Date**: 2026-05-07
**Author**: Orla Harper (claude-code:opus-4-7@anthropic, role: collaborator)

## Executive recommendation

**DEFER dashboard implementation; close Epic #966 as cancelled.**

Three findings drive the recommendation:

1. **Operator-only model**: per `instructions/operator-identity-context.instructions.md`, the operator (LLM) is the sole HAMR-state mutator; the client's role is design + UAT. A dashboard toggle for HAMR opt-in addresses a use case (client-driven fleet management) that doesn't exist in the harness contract.
2. **CLI activation is sufficient**: `npm run hamr:activate` + `MEGINGJORD_HAMR_DISABLED=1` env override cover both the on-path activation and the air-gap escape hatch. The operator can flip team state directly via SSH/CLI without a web UI.
3. **Coordination cost outweighs benefit**: Epic #966 explicitly requires Copilot Team coordination on shared dashboard files. The maintenance load of cross-team panel coordination + new HAMR Worker routes (`/teams`, `/teams/<name>/optin`) + KV consistency + audit log infrastructure is significant for a feature with no actual consumer.

If a future operator change makes web-driven team management necessary, this Epic can be re-opened with the design below as starting context.

---

## A. Dynamic team discovery — recommended source

| Candidate | Pros | Cons | Verdict |
|---|---|---|---|
| `inventory/devices.json` | Already maintained | Lists devices, not teams | Insufficient |
| Filesystem scan `~/.{*}/hamr-config.json` | Self-describing | Local-only; no fleet view | Discovery only |
| HAMR Worker `/teams` endpoint (new) | Centralized truth | New surface to build + maintain | Recommended for fleet view |
| Mailbox `team-registered` envelopes | Reuses #918 R2 mailbox | Eventual consistency; envelope retention questions | Use as backup signal |

**Recommendation if built**: Worker `/teams` route reading from KV prefix `hamr-team:*`. Each team writes its own marker on activation; staleness signaled by `last_seen` field.

**Refresh model**: lazy on dashboard panel mount + manual refresh button. No polling loop.

## B. Per-team status fields

Recommended display fields per team:
- `enabled` (boolean from KV `hamr-team:<name>.enabled`)
- `last_activated_at` (timestamp, KV)
- `last_seen` (heartbeat, KV — refreshed on each provider call via wrapper)
- `hit_rate_7d` (per-team aggregation of `cache-stats.jsonl` — currently global, needs partitioning)
- `quota_stale` (existing `/quota.stale` boolean from #941)
- `provider_spillover_active` (derived from `header-spillover.js` recent decisions)

Sources: 5/6 require new KV keys or aggregation work. `quota_stale` already exists.

## C. Opt-in toggle mechanism

**Write path**: client flip → POST signed envelope to `/teams/<name>/optin` → Worker writes KV → mailbox push to team runtime → team runtime polls mailbox on next provider call → updates local `~/.<team>/hamr-config.json`.

**Read path**: team runtime reads local `hamr-config.json` (cached); on TTL expiry, polls KV for authoritative state.

**Drift reconciliation**: KV is source of truth. Local marker mismatch → log warning + force re-fetch from KV.

**Bounded propagation**: ≤60s achievable only if mailbox poll interval ≤30s. Current poll cadence is 6h (cron). Would need sub-minute polling or push-style WebSocket — significant infra cost.

## D. Authorization & audit

- Operator-only (single signer): existing Ed25519 DPoP gate on `/mcp` (#894 / #927) extends naturally to `/teams/*`.
- Audit log: append to existing `~/.megingjord/baton-audit.log` JSONL with toggle envelope hash.
- Replay protection: existing nonce mechanism in DPoP envelope.

## E. UI design — ASCII wireframe

```
   ┌─────────────────────── Teams Panel ────────────────────────┐
   │                                                            │
   │  HAMR Opt-in Status                          [Refresh]     │
   │  ──────────────────────────────────────────────────────    │
   │                                                            │
   │   Team           Status      Last seen    Hit rate  ⚙      │
   │  ─────────────────────────────────────────────────────     │
   │   claude-code   ● enabled   2m ago        87% / 7d   ▣     │
   │   copilot       ● enabled   5m ago        82% / 7d   ▣     │
   │   codex         ○ disabled  1h ago         N/A       ▣     │
   │   <new-team>    ◌ unknown   never          N/A       ▣     │
   │                                                            │
   │  Status legend: ● enabled  ○ disabled  ◌ unknown ⚠ stale  │
   │                                                            │
   │  Toggle propagation target: ≤ 60s                          │
   │  Override env: MEGINGJORD_HAMR_DISABLED=1 wins              │
   └────────────────────────────────────────────────────────────┘
```

## F. Boundary & coordination

Dashboard files that would need modification:
- `dashboard/index.html` — add `<section id="teams-panel">` (new)
- `dashboard/css/views.css` — Teams panel styles (additive)
- `dashboard/js/event-bus.js` — new `teams:refresh` event (Copilot-owned; needs coordination)
- `dashboard/js/teams-panel.js` — NEW (additive, Claude Code Team owned)

**Copilot Team coordination required for**: `event-bus.js` only. All other surfaces additive-only.

## G. Integration points

New surfaces required:
- HAMR Worker route `GET /teams` — list teams with status fields
- HAMR Worker route `POST /teams/<name>/optin` — flip enabled boolean (DPoP-gated)
- KV prefix `hamr-team:*` — per-team state
- Per-team partitioning of cache-stats.jsonl (currently global)
- New global script `scripts/global/teams-discovery.js`

## H. Test strategy

- Worker route smoke: POST `/teams/test/optin` with valid DPoP → 200; without → 401
- Drift test: toggle dashboard → assert KV updated → assert local marker updated within 60s
- Empty state: no teams in KV → panel shows discovery hint
- Stale state: `last_seen` >24h → status pill shows ⚠

## Child ticket sketch (if Epic resumed)

Estimated effort if dashboard is built:

| # | Effort | Description | Depends |
|---|---|---|---|
| 1 | 0.5d | Worker `GET /teams` route | — |
| 2 | 0.5d | Worker `POST /teams/<name>/optin` route | 1 |
| 3 | 0.25d | KV prefix `hamr-team:*` writer in `hamr-activate.sh` | — |
| 4 | 1d | Per-team cache-stats.jsonl partitioning | — |
| 5 | 0.5d | `scripts/global/teams-discovery.js` | 1 |
| 6 | 1d | `dashboard/js/teams-panel.js` (new) | 5 |
| 7 | 0.25d | `dashboard/index.html` + CSS additive | 6 |
| 8 | 0.25d | event-bus.js `teams:refresh` (Copilot Team coord) | 6 |
| 9 | 0.5d | Smoke + integration tests | all |
| **Total** | **~5 days** | | |

## Conclusion

The dashboard panel is buildable but the cost-benefit is poor for the operator-only model. **Recommend cancelling Epic #966** with this research preserved as the starting point should the contract change.
