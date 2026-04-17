# dashboard/

Static Alpine.js single-page dashboard for devenv-ops fleet monitoring.
No build step — served directly by `scripts/dashboard-server.js`.

## Structure

```
index.html          — Single HTML entry point; loads all JS and CSS
css/                — One CSS file per visual feature
js/                 — One JS file per functional feature
```

## Feature-Based Naming Convention

Each `js/<feature>.js` and `css/<feature>.css` pair owns one
self-contained concern. Files are loaded globally; functions are
plain globals consumed by `app.js` (the Alpine root component).

| File | Responsibility |
|------|---------------|
| `app.js` | Alpine root component, init, refresh loop |
| `app-actions.js` | User actions split out of app.js |
| `activity-feed.js` | Live Agile event log |
| `baton-flow.js` | Role baton state and rendering |
| `event-bus.js` | SSE-backed live event polling |
| `fleet-topology.js` | Network graph panel |
| `health-check.js` | Ollama/OpenClaw liveness probes |
| `live-stats.js` | Ollama telemetry fetch + formatBytes |
| `quota-tracker.js` | Free-tier API quota display |
| `render-panels.js` | Panel HTML rendering helpers |
| `wiki-panel.js` | Wiki health and metrics panel |

## Rules

- **≤100 lines per file** (enforced by `npm run lint`)
- No `innerHTML` assignment — use Alpine `x-html` or template literals
- No `var` declarations — `const`/`let` only
- Named constants for all magic numbers
