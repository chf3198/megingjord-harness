# Megingjord — Architecture

> **Canonical role (Epic #3124 D8):** the detailed architecture *reference* (docs-tree depth,
> arc42-structured). For the short root overview see [`../ARCHITECTURE.md`](../ARCHITECTURE.md).
> Taxonomy: [`diataxis-taxonomy.md`](diataxis-taxonomy.md).

Navigation hub for architecture documentation, structured after arc42 sections.

## Document map

| Section                               | File                                                                    | arc42 ref          |
| ------------------------------------- | ----------------------------------------------------------------------- | ------------------ |
| Executive overview, goal constitution | [`ARCHITECTURE.md`](../ARCHITECTURE.md)                                 | §1 Intro & Goals   |
| Two-tier layer model detail           | [`docs/architecture-layer-model.md`](architecture-layer-model.md)       | §7 Deployment      |
| Baton governance model                | [`docs/architecture-baton-model.md`](architecture-baton-model.md)       | §8 Crosscutting    |
| Multi-runtime parity                  | [`docs/architecture-runtime-parity.md`](architecture-runtime-parity.md) | §5 Building Blocks |
| Routing, fleet, cascade dispatch      | [`docs/architecture-routing.md`](architecture-routing.md)               | §6 Runtime View    |
| Deployment model, Layer-2, sync       | [`docs/architecture-deployment.md`](architecture-deployment.md)         | §7 Deployment      |
| Governance CI, wiki, dashboard        | [`docs/architecture-governance.md`](architecture-governance.md)         | §8 Crosscutting    |

## High-level data flow (C4 — Context)

```
Editor / Agent runtime         Routing               Execution               Governance
───────────────────────        ───────────           ─────────────           ──────────────
VS Code Copilot          ─→    cascade-dispatch ─→  Fleet (Ollama via        GitHub issues +
Claude Code                    + model-routing-     Tailscale)               workflows + skills
Codex                          policy.json          OR Cloud (Claude /       + scripts/global/
                                                    OpenAI / Groq /
                                                    Gemini / Cerebras)
                                                          │
                                                          ▼
                                               .dashboard/events.jsonl
                                                          │
                                                          ▼
                                                 Dashboard (SSE :8090)
```

## Subsystem index

| Subsystem                | Entry point                          | Detail                                                   |
| ------------------------ | ------------------------------------ | -------------------------------------------------------- |
| **Routing**              | `scripts/global/cascade-dispatch.js` | [architecture-routing.md](architecture-routing.md)       |
| **Capability detection** | `scripts/global/capability-probe.js` | [architecture-routing.md](architecture-routing.md)       |
| **Governance CI**        | `.github/workflows/baton-gates.yml`  | [architecture-governance.md](architecture-governance.md) |
| **Wiki system**          | `wiki/` + `scripts/wiki/ingest.js`   | [architecture-governance.md](architecture-governance.md) |
| **Dashboard**            | `dashboard/index.html`               | [architecture-governance.md](architecture-governance.md) |
| **Fleet**                | `resolve-inventory.js` + `*.example.json` | [architecture-routing.md](architecture-routing.md)       |
| **Deployment**           | `scripts/deploy.sh`                  | [architecture-deployment.md](architecture-deployment.md) |

## Key quality attributes

- **G1 Governance**: policy, role, provenance enforced at CI layer
- **G2 Quality**: lint + readability + test-evidence gates on every PR
- **G3 Zero Cost**: free-cloud (Gemini) and fleet (Ollama) before paid providers
- **G4 Privacy**: sensitive context stays local unless explicitly overridden

Full goal constitution: [`ARCHITECTURE.md § Harness Goal Constitution`](../ARCHITECTURE.md)
