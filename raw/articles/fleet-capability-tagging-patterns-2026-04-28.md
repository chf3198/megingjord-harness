---
title: "Fleet Capability Tagging Patterns"
date: 2026-04-28
source_url: research/fleet-capability-tagging-research.md
author: devenv-ops
tags: [fleet, routing, metadata, capabilities]
status: ingested
---

# Fleet Capability Tagging Patterns

Capability tagging for heterogeneous inference fleets follows a stable pattern:
**labels on resources + selectors in schedulers**.

## Pattern Summary

- Resource metadata is normalized into enums (`tier`, `class`, `capabilities`).
- Router picks candidates from metadata, then applies health and priority checks.
- Model dispatch is downstream from device selection, not mixed with it.

## DevEnv Ops Mapping

- Resource records: `inventory/devices.json`
- Selection logic: `scripts/global/task-router.js`
- Policy hints: `scripts/global/task-router-policy.json`
- Documentation surfaces: wiki concepts + source digests

## Recommended Minimal Schema

- `routing.tier`
- `routing.inferenceClass`
- `routing.capabilities[]`
- `routing.modelClass[]`
- `routing.priority`
- `routing.preferredFor[]`

## Why This Works

- Stable during hardware churn
- Auditable in Git and wiki artifacts
- Enables predictable fleet-lane cost control