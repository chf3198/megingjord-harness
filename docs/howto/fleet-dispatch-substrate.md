# Fleet dispatch substrate — operator guide

_Epic #3126 / #3803. Modules: `scripts/global/fleet-registry.js`, `fleet-preflight.js`,
`fleet-resource-optimizer.js`, `consensus-honest-stop.js`, `fleet-roi-telemetry.js`._

The cross-model consensus gate is meant to be a **$0 token-saver**. This substrate is what
makes that true in practice: it finds the free resources, picks the cheapest adequate one,
stops honestly when the panel can't reach the gate, and measures whether the whole thing is
actually net-positive.

## Why it exists (the defects it closes)

| Defect | Effect | Fix |
|---|---|---|
| `ollama-direct.js` hardcoded ONE host | Host B (`100.78.22.13`) — the only source of the non-Qwen **deepseek** + **granite** families — 404'd and fell through to cloud. Local cross-family diversity was dead. | AC2: settings-driven host list + model-aware host resolution with failover |
| No model-capability data | `qwen3:32b` (a _thinking_ model at ~1.5 tok/s + 64s cold load) returned empty / timed out at 306s against a 7b-class budget | AC3: capability registry sets `think:false` and sizes the timeout |
| Raters failed mid-run | `unknown_provider` / `no_key` / `429` discovered only after spending the run | AC1: preflight reports reachability + key presence + family first |
| Correlated panel | A same-family trio anchors near 82, so a `>93` gate is unreachable — and the loop iterated forever | AC4: `consensus-max` honest stop |
| ROI unfalsifiable | "Overhead exceeds savings" could not be checked | AC5: per-run ROI event |

## Configure the hosts (G5 — no hardcoded IPs)

`config/fleet-hosts.json` is the source of truth:

```json
{ "hosts": [ { "id": "winresource-36gb", "url": "http://100.91.113.16:11434",
              "families": ["qwen", "llama"], "max_concurrency": 1 } ] }
```

`max_concurrency` is **1** on purpose: Ollama serializes per host, so parallel fan-out to one
host just aborts. Override without touching the repo:

```bash
export MEGINGJORD_FLEET_HOSTS='[{"id":"mine","url":"http://10.0.0.5:11434","families":["qwen"]}]'
export MEGINGJORD_FLEET_HOSTS='http://a:11434,http://b:11434'   # short form
export FLEET_HOSTS_PATH=/path/to/fleet-hosts.json              # relocate the file
```

A missing or malformed config degrades to an empty list — callers keep their existing fallback
(G6). `OLLAMA_URL` and an explicit `opts.ollamaUrl` still win, so existing callers are unchanged.

## Use it

```js
const { fleetPreflight } = require('./scripts/global/fleet-preflight');
const { selectOptimal, selectDiversePanel } = require('./scripts/global/fleet-resource-optimizer');
const { evaluateGate } = require('./scripts/global/consensus-honest-stop');
const { recordRun } = require('./scripts/global/fleet-roi-telemetry');

const pre = await fleetPreflight();            // AC1 — cheap, no inference, no tokens
const pick = selectOptimal(pre.usable, { taskClass: 'standard' });   // AC6
const jury = selectDiversePanel(pre.usable, 3);                       // AC6 — distinct families
const gate = evaluateGate(jury, 93);                                  // AC4
if (!gate.proceed) console.log(gate.report);   // "consensus-max=88 on [qwen, llama] — ..."
recordRun({ free_calls: 3, failed_dispatches: 0, families: gate.families, ticket: 3803 }); // AC5
```

## How the optimizer decides (AC6)

**Not** a weighted sum. A linear `quality_w1 + cost_w2 + speed*w3` lets a marginal quality gain
buy a paid escalation, silently defeating G3 (this was caught in development: a 0.82-quality $0
local model lost to a 0.95-quality paid one). Instead it is the harness's cost-ascending
mandate — _"start in the lowest **adequate** lane"_ — as a lexicographic rule:

1. **Adequacy threshold** — drop candidates below the task's quality bar (`routine` 0.4 /
   `standard` 0.55 / `high-stakes` 0.7). Below the bar is a G2 failure dressed as a G3 win.
2. **Free before paid** — among adequate candidates, `$0` always wins.
3. **Quality**, then **speed**, as tie-breakers.

A paid pick is therefore only ever returned when **no** free candidate cleared the bar, and it
carries `escalate: true` + an `escalation_reason` so the spend is auditable (G8), never silent.

`selectDiversePanel` takes the best candidate from each **distinct family** before any second
member of a family — the direct fix for correlated-panel collapse. Models the registry marks
`judge_eligible: false` (3b-class, which produce falsely-inflated scores) are excluded from juries.

## Model capabilities (AC3)

`config/model-capability-registry.json` — `family`, `params_b`, `thinking`, `tok_per_s`,
`cold_load_s`, `timeout_ms`, `quality`, `judge_eligible`. Unknown models resolve to `default`
(never `undefined`), and tag drift (`qwen3:32b-q4_K_M`) resolves to the base profile. Add a model
by adding a row — no code change.

## ROI telemetry (AC5)

Appends a schema-v3 event per run to `~/.megingjord/fleet-roi.jsonl` (override:
`MEGINGJORD_ROI_LOG`). `net_positive` is **computed**, not asserted. The `$` figure is an
estimate (assumes ~1500 tokens/call; price via `MEGINGJORD_PAID_COST_PER_1K`) — the **sign** is
the signal. A telemetry write failure never breaks a governed run.

## Boundary

This is the **substrate** layer only. Epic #3069 (review-workflow) and #3576/#3585
(policy/activation) _consume_ these modules — they do not re-implement them.
