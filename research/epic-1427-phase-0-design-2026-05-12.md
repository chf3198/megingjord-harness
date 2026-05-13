# Epic #1427 Phase-0 — Token Spend Reduction for Core Orchestrating Services
Date: 2026-05-12

## Summary Table
| Topic | Finding |
|---|---|
| Problem | Claude Code, Copilot, and Codex sessions spend tokens on repeated context, boilerplate, telemetry, and over-broad prompts. |
| Goal | Reduce average token spend per agent session without weakening correctness or governance. |
| Phase-0 output | Waste taxonomy, baseline measurement plan, control matrix, and Phase-A/B/C ticket sequence. |
| Best-fit controls | Deterministic prompt compression, scoped context bundles, cache/dedup gating, and token-cost telemetry. |

## Token Waste Taxonomy
| Waste vector | Severity | Frequency | Why it costs tokens | Existing evidence |
|---|---|---|---|---|
| Repeated instruction payloads | High | High | Large skill/instruction text is re-sent even when already in context. | `prompt-reduction-playbook.md`, long repo instructions, repeated baton setup. |
| Redundant prompt boilerplate | High | High | Role preambles, baton headers, and reminders are often copied verbatim across sessions. | `instructions/*`, `goal_lens.py`, baton artifacts. |
| Over-broad context windows | High | Medium | Tasks often carry unrelated files/history that are not required for the current turn. | `constitution-compressor.js` already shows deterministic bundling as a remedy. |
| Verbose governance output | Medium | High | Audit/validation reports are rich but can be compacted for repeat consumers. | `governance:audit`, `cost-report.js`, closeout comments. |
| Raw JSON telemetry passed to agents | Medium | Medium | Unfiltered telemetry consumes context even when only a summary is needed. | `cost-telemetry.js`, `cache-stats.jsonl`, `logs/copilot-usage.json`. |
| Repeated rehydration / duplicate reads | Medium | Medium | The same context is reloaded or reread across child prompts and follow-ups. | `prompt-reduction-playbook.md` recommends batching and reusable prompt files. |
| Cache-miss churn | High | Medium | Wasted routing/context work happens when cache/dedup signals are not acted on. | `cache-hit-gate.js`, `cache-stats.jsonl`, sticky-cache research. |

## Baseline Measurement Methodology
1. **Collect per-session cost rows** from `logs/cost-telemetry.jsonl` using `scripts/global/cost-telemetry.js`.
2. **Normalize by service and category**: context injection, governance output, telemetry, and boilerplate.
3. **Use a token proxy** for text-heavy paths via `scripts/global/token-cost-benchmark.js` and char/4 approximation when exact tokenizers are unavailable.
4. **Track cache effectiveness** with `scripts/global/cache-hit-gate.js` and `cache-stats.jsonl` (7-day window).
5. **Compare routing behaviors** using `scripts/global/cost-report.js` and routing telemetry summaries.
6. **Measure qualitative risk** by pairing the cost baseline with `scripts/global/ide-proxy-quality-parity.js` so savings never outrun quality.

## Control Matrix
| Control class | What it does | Harness entry points | Token effect |
|---|---|---|---|
| Preventive | Shrinks prompts and loaded context before a session starts. | `scripts/global/constitution-compressor.js`, `instructions/prompt-reduction-playbook.md`, `hooks/scripts/goal_lens.py` | Lowers initial prompt size and avoids repeated boilerplate. |
| Detective | Reports where tokens are being consumed and where savings are real. | `scripts/global/cost-telemetry.js`, `scripts/global/cost-report.js`, `scripts/global/token-cost-benchmark.js` | Makes spend visible and comparable by lane/service. |
| Corrective | Gates bad routing/cold cache behavior and forces fallback or compression. | `scripts/global/cache-hit-gate.js`, `scripts/global/model-routing-telemetry.js`, `scripts/global/cache-stats-emit.js` | Prevents unnecessary premium calls and cache churn. |

### Control flow visual
```text
prompt/file selection
        |
        v
constitution-compressor / scoped prompt bundle
        |
        v
routing + cache gate + goal lens
        |
        v
cost telemetry + quality parity measurement
        |
        v
reporting / rollback if cost improves but quality drops
```

## Gap Analysis Against Existing Harness Tooling
| Existing tool | What exists today | Gap for #1427 |
|---|---|---|
| `constitution-compressor.js` | Deterministic compressor exists. | Not yet tied to an execution policy for orchestrating sessions. |
| `prompt-reduction-playbook.md` | Good guidance and auto-context rules. | Guidance-only; not enforced by a workflow or ticketed control plane. |
| `cost-telemetry.js` | Records cost rows and aggregates by lane. | Needs stronger per-service/category attribution and a decision loop. |
| `cache-hit-gate.js` | Enforces a cache hit floor. | Measures cache health, but not prompt/context waste directly. |
| `ide-proxy-quality-parity.js` | Measures quality parity. | Useful guardrail, but not a token reducer by itself. |
| `goal_lens.py` | Adds G1-G9 decision context. | Good for governance decisions, but needs cost-aware scoping rules for token minimization. |

## Recommended Phase-A/B/C Ticket Sequence
| Phase | Proposed child ticket | Scope | Exit signal |
|---|---|---|---|
| Phase-A | Prompt compression + context scoping | Integrate deterministic compression and scoped bundles into prompt/session startup. | Prompt payloads shrink without quality regression. |
| Phase-B | Caching + dedup controls | Deduplicate repeated bundles and enforce cache-friendly routing for repeated context. | Cache hit rate rises; duplicate context reads fall. |
| Phase-C | Telemetry + automated measurement | Surface per-service cost telemetry, scorecarding, and rollback triggers. | Cost reduction is measurable and reversible if quality drops. |

## Recommended Success Criteria
- Reduce recurring prompt/context overhead on orchestrating services.
- Maintain or improve quality parity while lowering premium-token burn.
- Keep the controls observable via telemetry instead of relying on manual intuition.
- Preserve governance compliance and existing role/baton rules.

## Last-updated
2026-05-12T00:00:00Z

## Actionable Next Steps
1. Sign off Phase-0 and close the gate ticket.
2. File Phase-A/B/C implementation children with measurable ACs.
3. Wire the token-cost baseline into recurring reporting so the gains are visible.
4. Reconcile any quality regressions against the quality-parity guardrail before rollout.

Signed-by: Soren Mason
Team&Model: copilot:claude-sonnet-4-6@github
Role: manager