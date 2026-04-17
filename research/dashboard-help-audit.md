# Dashboard Help Content Audit

**Status**: Accepted | **Date**: 2026-04-17 | **Ticket**: #221

## Summary

Audit of 20 panels against help-user.js (12 entries) and help-dev.js
(8 entries). 10 panels have broken or missing help coverage.

## Coverage Matrix

| Panel | data-tip | Has Tooltip? | Help Link | Exists? |
|-------|----------|:----------:|-----------|:-------:|
| Agent Baton | baton | ✅ | use-baton | ✅ |
| Fleet Health Log | fleet-health | ✅ | use-health | ✅ |
| Live Activity | activity | ✅ | use-activity | ✅ |
| Resources (Fleet) | resource-mon | ✅ | resources | ❌ |
| Context Flow | context-flow | ✅ | use-context | ✅ |
| LLM Context | llm-context | ✅ | use-quotas | ✅ |
| GitHub Activity | github | ✅ | use-github | ❌ |
| Quotas | quotas | ✅ | use-quotas | ✅ |
| Task Router | router | ✅ | use-router | ✅ |
| Router Log | router-log | ✅ | use-router | ✅ |
| Governance | governance | ✅ | use-governance | ✅ |
| Ticket Log | ticket-log | ✅ | use-ticket-log | ❌ |
| Dashboard Config | config | ✅ | controls | ❌ |
| Stress Test | test-panel | ✅ | controls | ❌ |
| Wiki Health | wiki | ✅ | views | ❌ |
| Wiki Metrics | wiki-metrics | ❌ | — | — |
| Research Wiki | wiki-reader | ✅ | views | ❌ |
| Fleet Devices | devices | ✅ | data | ❌ |
| Services | services | ✅ | data | ❌ |
| Fleet Resources | settings | ⚠️ | — | — |

## Gaps to Fill

### Missing Help Sections (need new entries in help-user.js)
1. `use-resources` — Fleet Resources monitor (devices/services)
2. `use-github` — GitHub Activity panel
3. `use-ticket-log` — Ticket Log audit trail
4. `use-config` — Dashboard Settings (refresh, contrast)
5. `use-stress` — exists but tooltip doesn't link to it
6. `use-wiki-health` — Wiki Health summary
7. `use-wiki-metrics` — Wiki Metrics details
8. `use-wiki-reader` — Research Wiki browser
9. `use-devices` — Fleet Devices inventory
10. `use-services` — Services inventory
11. `use-settings` — Fleet Resources credential mgmt

### Missing Tooltip Entries
1. `wiki-metrics` — no tooltip definition
2. `settings` — no panel-level tooltip (only nav)

## Anchor Navigation Design

Pattern: `<button class="shb" onclick="goHelp('{id}')">`
`goHelp()` calls `setView('help')`, then `requestAnimationFrame` + `scrollIntoView`.
Each help entry rendered with `id="help-{sectionId}"` anchor.

## Tooltip Text Drafts (for all 20 panels)

| Panel | Tooltip (1-2 sentences) |
|-------|------------------------|
| Agent Baton | Live Agile baton pipeline. Shows current role. |
| Fleet Health | Timestamped device health events from probes. |
| Live Activity | Real-time event stream from SSE. |
| Resources | OpenClaw, Tailscale mesh, Ollama fleet status. |
| Context Flow | Prompt routing diagram showing skill resolution. |
| LLM Context | Token usage and context window per model. |
| GitHub Activity | Recent commits, PRs, and issues from GitHub. |
| Quotas | Daily API usage bars for free-tier services. |
| Task Router | Task distribution across free/fleet/premium. |
| Router Log | Per-request model selection and latency log. |
| Governance | Baton adherence, hook compliance, violations. |
| Ticket Log | Full audit trail of ticket state transitions. |
| Dashboard Config | Refresh interval, contrast, tooltip settings. |
| Stress Test | Simulates parallel ticket load for benchmarks. |
| Wiki Health | Research wiki page count and coverage metrics. |
| Wiki Metrics | Detailed wiki access and quality statistics. |
| Research Wiki | Browse and search research markdown pages. |
| Fleet Devices | Hardware inventory with Tailscale connectivity. |
| Services | API service cards with status and endpoints. |
| Fleet Resources | LLM credential store and health probes. |

## Actionable Next Steps

1. Add `.shb` to 8 panels missing them (#222)
2. Create `goHelp()` navigation function
3. Add anchor IDs to help-content.js renderer (#223)
4. Add 11 missing help-user.js entries (#223)
5. Fix tooltip links for 10 panels
