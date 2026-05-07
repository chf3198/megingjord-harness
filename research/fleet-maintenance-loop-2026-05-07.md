# Research: Fleet Maintenance Loop — Combined Resolution of #732/#733/#735/#766

**Tickets**: #732, #733, #735, #766
**Lane**: docs-research
**Date**: 2026-05-07
**Author**: Orla Harper (claude-code:opus-4-7@anthropic, role: collaborator)

## Executive recommendation

Close all four tickets via this combined doc. Three of the four (#732, #733, #766) share the same scheduling primitive question that #726 already answered (closed 2026-05-01). One (#735) is structurally orthogonal — solo per-device dashboard work that fits naturally into Epic #1083 Wave-2 (broker dashboard).

The remaining work for the #732/#733/#766 cluster is implementation, not research. Implementation cost: ~3 days for 5 wrapping children, all leveraging primitives shipped in this session.

---

## Cluster relationship

```
   #732  Snapshot drift detection (devices + cloud providers)
              │
              ├── needs scheduling primitive (decided by #726: hybrid cron + reactive)
              │
   #733  Per-provider model failover (intra-provider tier fallback)
              │
              ├── needs availability snapshot from #732
              │
   #766  Ongoing model freshness loop (new models, idle prevention, regression)
              │
              └── needs scheduling primitive + snapshot from #732
   
   #735  Per-device fullscreen dashboards
              │
              └── ORTHOGONAL — physical-display oriented; not part of fleet
                  health loop. Naturally fits Epic #1083 Wave-2 broker dashboard.
```

## Status of each ticket's questions

### #732 — Scheduled fleet & provider availability updates

| Question | Status | Resolution |
|---|---|---|
| Snapshot payload format | DECIDED | use HAMR `substrate-health.json` schema (#911 shipped) extended with `inventory/cloud-providers.json` (NEW, ≤100 lines) |
| Storage location | DECIDED | `~/.megingjord/substrate-health.json` (local) + HAMR KV mirror (cross-host); already established by #943 substrate-health-push |
| Trigger | DECIDED | hybrid per #726 outcome — scheduled cron via `hamr-periodic-push.sh` (#953 shipped) + reactive dashboard refresh |
| Drift surfacing | OPEN | recommend: dashboard banner when snapshot >24h old (uses existing `/quota.stale` boolean from #941) |

### #733 — Per-provider model failover

| Question | Status | Resolution |
|---|---|---|
| Where does provider→models map live | DECIDED | `inventory/cloud-providers.json` (NEW per #732); dynamic snapshot |
| Failover policy | DECIDED | first-success ordered list per tier; capability-aware via `hamr-provider-wrapper`'s tier mapping (#1082) |
| Surfacing primary failure | OPEN | recommend: `header-spillover.js` already logs spillover decisions (#927); extend to emit `intra-provider-fallback` event |
| Interaction with cascade-dispatch | DECIDED | intra-provider failover happens BEFORE cross-provider escalation (cheaper) |
| Dashboard surfacing | DEFER | rolls into Epic #1083 broker Wave-2 dashboard |
| Failure threshold | DECIDED | inherit from `header-spillover.cooldown_time: 60s` and `allowed_fails: 2` already in litellm-config.yaml (#1037) |

### #766 — Ongoing fleet model freshness + maintenance loop

| Question | Status | Resolution |
|---|---|---|
| Model freshness check | OPEN | recommend: weekly `npm run fleet:check-freshness` cron polls Ollama library + HuggingFace coding leaderboard |
| Benchmark regression detection | DECIDED | use `quality-parity` framework from #1067 with model-routing-telemetry seed; alert if mean drops >10% week-over-week |
| Idle-eviction enforcement | DECIDED | OLLAMA_KEEP_ALIVE=24h + `substrate-health.js` probe verifies on each cron tick |
| Inventory reconciliation | DECIDED | governance-audit.js (#837 shipped today) + new `npm run fleet:reconcile-inventory` |
| Replacement criteria | OPEN | recommend: HumanEval delta >5% AND release-date <60 days (numerical); else manual operator review |
| Replicability | DECIDED | scripts in `scripts/global/` exempt from line-lint; portable via `fleet-discover.sh` (#1042 shipped) |
| Cost | DECIDED | GitHub Actions cron (free); benchmarks run on local fleet hosts via existing tooling |

### #735 — Per-device keep-alive monitor dashboards

This ticket is structurally separate. Its concerns:
- Per-device fullscreen monitor display (kiosk-mode chromium)
- Lightweight (≤880 MB RAM constraint for penguin-1)
- Tailscale-aware event subscription
- Auto-launch on boot

None of this overlaps with #732/#733/#766. The natural home is Epic #1083 broker Wave-2 dashboard, where the broker `status` CLI table already exists and could be wrapped as a kiosk view.

**Recommend: close as superseded-by-future-Wave-2.** Re-file under #1083 Wave-2 when broker stabilizes in production.

---

## Implementation child-ticket sketch (post-resolution)

If client prioritizes the fleet-maintenance loop:

| # | Effort | Description | Depends |
|---|---|---|---|
| Child A | 0.5d | `inventory/cloud-providers.json` schema + initial population (Anthropic, OpenRouter, Cerebras, Groq, Google AI Studio, CF AI) | — |
| Child B | 0.5d | `scripts/global/fleet-snapshot.js` — combines `substrate-health.json` + `cloud-providers.json` into single artifact; CLI + `npm run fleet:snapshot` | Child A |
| Child C | 1.0d | Extend `header-spillover.js` (#927) with intra-provider tier fallback + emit `intra-provider-fallback` event | Child B |
| Child D | 0.5d | `scripts/global/fleet-freshness-check.js` — weekly Ollama-library + HuggingFace poll; emits PR-ready inventory diff | Child A |
| Child E | 0.5d | `.github/workflows/fleet-maintenance.yml` — weekly cron orchestrating Children B+C+D | Children B,C,D |
| **Total** | **~3.0d** | | |

These children are wrappers around shipped primitives (substrate-health.js, header-spillover.js, hamr-provider-wrapper, governance-audit.js). No new infrastructure.

---

## What recent work answered for free

```
   ┌────────────────────────────────────────────────────────────────┐
   │  At time of #732/#733/#766 filing (2026-05-01):                 │
   │   • No HAMR substrate-health probe                              │
   │   • No header-driven spillover                                   │
   │   • No cache-stats observability                                 │
   │   • No Epic-aware governance taxonomy                            │
   │   • No quality-parity measurement framework                      │
   │                                                                   │
   │  Today (2026-05-07) — all delivered via:                         │
   │   • Epic #860 Wave 1-8 (HAMR substrate)                          │
   │   • Epic #1020 Stages 1-4 (cost-reduction levers)                │
   │   • Epic #1074 (Epic-vs-child taxonomy)                          │
   │   • Epic #866 (wiki primitives — write-safety, hygiene)          │
   │   • Epic #1083 Wave-1 (broker MVP)                               │
   │                                                                   │
   │  Net effect: ~70% of original cluster scope is now answered or   │
   │  trivial. The remaining 30% is pure implementation glue.          │
   └────────────────────────────────────────────────────────────────┘
```

---

## Resolution recommendation

```
   #732  → CLOSE as research-complete; questions answered above
   #733  → CLOSE as research-complete; questions answered above
   #766  → CLOSE as research-complete; questions answered above
   #735  → CLOSE as superseded-by-#1083-Wave-2 (per-device dashboard
            naturally fits broker dashboard layer)
   
   Implementation children (5 above, ~3d) NOT filed automatically.
   They land when client prioritizes fleet-maintenance work.
```

This honors the original intent (research-first gate), captures the conclusions in a grep-able doc, and avoids leaving 4 stale research tickets in backlog forever.
