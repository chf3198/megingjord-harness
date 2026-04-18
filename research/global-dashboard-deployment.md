# Research: Global Dashboard Deployment Patterns

**Ticket**: #160 (parent #159)
**Date**: 2026-04-18

## Problem

Dashboard only launchable from devenv-ops via `npm start`.
Need: launch from any repo with `~/.copilot/` runtime.

## Patterns Evaluated

### A. Global launch script (SELECTED)
- `~/.copilot/scripts/dashboard-serve.js` serves static + API
- Static from `~/.copilot/dashboard/`, APIs from `~/.copilot/`
- Zero node_modules dependency (uses Node built-ins only)
- Fits ≤100-line constraint with API split into helper file

### B. Symlink approach (REJECTED)
- Fragile: breaks if devenv-ops moves or missing
- Doesn't achieve "any repo" goal

### C. npx launcher (REJECTED)
- Requires npm publish, version management overhead
- Overkill for single-user fleet

## Architecture Decision

```
~/.copilot/
  dashboard/          ← static HTML/CSS/JS (deployed)
    index.html
    css/
    js/
  scripts/
    dashboard-serve.js  ← entry point (global)
    dashboard-api.js    ← API handler with ~/.copilot/ paths
    fleet-config.js     ← fleet auto-detection (exists)
```

### Path Resolution Strategy
- `COPILOT_HOME` env var or `~/.copilot/` default
- All API reads resolve from `COPILOT_HOME`
- Static serving from `COPILOT_HOME/dashboard/`
- Repo-context APIs (governance) use calling-dir fallback

### Launch Methods
1. Direct: `node ~/.copilot/scripts/dashboard-serve.js`
2. Bootstrap: npm script added to bootstrapped repos
3. Alias: `alias devenv-dash='node ~/.copilot/scripts/dashboard-serve.js'`

## Constraints
- ≤100 lines per file
- No node_modules (Node built-ins only)
- Fleet-profile aware via fleet-config.js
- Graceful degradation when resources missing
