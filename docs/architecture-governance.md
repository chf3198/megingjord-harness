# Architecture — Governance, Wiki, and Dashboard

## Governance CI system

Every PR runs a chain of required GitHub Actions workflows:

| Workflow | Purpose | Gate |
|---|---|---|
| `baton-gates.yml` | Manager→Collaborator→Admin→Consultant artifact chain | ✅ required |
| `evidence-completeness.yml` | Issue must be OPEN + all baton artifacts present | ✅ required |
| `lint-required.yml` | All files ≤100 lines | ✅ required |
| `doc-update-gate.yml` | Docs updated or `[skip-doc-gate]` with justification | ✅ required |
| `branch-name-required.yml` | `feat/<N>-` or `fix/<N>-` or `chore/` pattern | ✅ required |
| `pr-title-required.yml` | Conventional Commits, subject ≤60 chars | ✅ required |
| `quality-required.yml` | `lint:readability:ci` passes | ✅ required |
| `changelog-fragment.yml` | `.changes/unreleased/<N>.md` exists | ✅ required |
| `danger-required.yml` | Danger JS policy (large PR blocker-note, etc.) | ✅ required |

Supporting scripts:
- `scripts/global/governance-drift-classifier.js` — detects policy/config drift
- `scripts/global/ticket-reconcile.js` — local↔GitHub ticket consistency check
- `scripts/global/epic-close-validator.js` — validates epic close-readiness
- `scripts/global/baton-artifact-governance.js` — validates baton artifact structure

## Wiki system (LLM knowledge base)

The wiki is a three-layer knowledge system deployed to `~/.copilot/wiki/`:

| Layer | Path | Owner | Purpose |
|---|---|---|---|
| Raw sources | `raw/` | Human | Immutable after placement |
| Wiki pages | `wiki/` | LLM | Derived knowledge; freely updated |
| Schema | `wiki/WIKI.md` | Co-owned | Conventions and page contracts |

Wiki pipeline (`scripts/wiki/`):
1. `ingest.js` — reads `raw/` sources; writes/updates wiki pages
2. `lint.js` — checks frontmatter completeness, broken links, stale timestamps
3. `anneal.js` — cross-reference pass; ensures bidirectional wikilinks

Page types: `entity` (person/device/service), `concept` (idea/pattern),
`source` (raw-source digest), `synthesis` (cross-cutting analysis).

Consumed by `scripts/global/wiki-search.js` via `npm run help:topic`.

## Dashboard architecture

The fleet monitoring dashboard is a zero-build-step static web app on `:8090`:

```
dashboard/
├── index.html            # Alpine.js shell; panels declared as <template>
├── js/
│   ├── app.js            # dashboardApp() Alpine root; refresh cycle
│   ├── render-panels.js  # Pure render functions → HTML string per panel
│   ├── event-source.js   # SSE client (connects to :8090/events)
│   └── event-bus.js      # Internal pub/sub; decouples panels
└── css/app.css
```

`scripts/dashboard-server.js` — Node HTTP server:
- `GET /events` — SSE stream; broadcasts `.dashboard/events.jsonl` tail
- `GET /state` — fleet health, capability cache, ticket summary snapshot
- Static file serving for all `dashboard/` assets

Data inputs:
- `.dashboard/events.jsonl` — append-only log of all agent and tool events
- `.dashboard/state/*.json` — fleet health, capability cache, skill manifest

## Governance chains

`config/governance-chains.yml` defines dependency chains between governance
documents and scripts. Run `npm run governance:chains:check` after changing
any file in `instructions/`, `hooks/`, `.github/workflows/`, or `config/`.

Broken chains (a file changed without updating its downstream dependents)
fail the `quality-required` CI check.
