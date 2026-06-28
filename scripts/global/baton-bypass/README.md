# Baton Bypass Governance

Refs #3292, Epic #3284 (W4).

## Overview

This module implements the bypass governance plane for the Megingjord baton
workflow. It replaces ad-hoc env-var bypass flags with structured, auditable
override primitives.

## Modules

- **override-label.js** -- Parse and validate structured override
  labels/comments. Every override carries a gate, reason, approver alias,
  and ISO8601 expiry timestamp.
- **override-expiry.js** -- Scheduled-job core that finds and removes
  override labels past their expiry, emitting incidents.
- **break-glass.js** -- Emergency bypass requiring TWO distinct PR-review
  approvals, recorded as a hash-linked entry in the W1a Ed25519 event chain.
- **env-flag-classifier.js** -- Enumerates legacy env bypass flags and
  classifies each as `ux-local-only` (safe, CI ignores) or
  `authority-affecting` (CI authority removed; must use label + approver).
- **override-telemetry.js** -- Per-gate-per-week override counts with
  Tier-2 anneal incident emission on threshold breach.

## BYPASS_FLAG_REGISTRY

The `BYPASS_FLAG_REGISTRY` in `env-flag-classifier.js` is the canonical
allow-list and the #2892 per-repo config surface. Every known env bypass
flag is listed with its classification and description.

### Classifications

- **ux-local-only**: The flag may downgrade local hook behavior (operator
  convenience). CI workflows ignore it entirely. No governance risk.
- **authority-affecting**: The flag historically relaxed CI authority. That
  power is now REMOVED (`ci_authority: false`). The equivalent override must
  use a server-visible label with an approver alias and expiry.

### Contract

A local env var can NEVER relax CI authority. Only server-visible labels
with approver + expiry (parsed by `override-label.js`) may relax CI gates.
