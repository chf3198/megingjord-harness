# ADR-002: Dashboard Stack — Alpine.js + Static

**Status**: Accepted
**Date**: 2026-04-11

## Context

Need a monitoring dashboard for fleet health, API quotas, and skill status.
Must run on Chromebook hardware and deploy to Cloudflare Pages.

## Decision

Use same stack as tsv-ledger: Alpine.js for reactivity, vanilla CSS,
no build step. Serve as static files. Deploy via Cloudflare Pages.

## Consequences

- **Pro**: Consistent with existing skills, no learning curve
- **Pro**: No build step means zero-config deployment
- **Pro**: Runs on any device with a browser
- **Con**: No server-side logic (health checks run client-side or via Workers)
- **Con**: CORS considerations for cross-device API calls
