---
title: Megingjord Harness Convergence Design v1
date: 2026-05-05
source: research/harness-convergence-design-2026-05-05.md
epic: 922
---

# Megingjord Harness Convergence Design v1

The harness has 4 axes (governance / tooling / fleet / HAMR) plus the
Dashboard as observation/control plane. HAMR is shared substrate;
Claude Code Team maintains it; cross-team consumers integrate via the
hamr-provider-wrapper contract. substrate-health gates the
model-routing-engine UPSTREAM of cascade-dispatch via a new
`cascade-policy-overrides.json` indirection. Per-team config markers
declare `axis_consumers`. SKILL.md frontmatter is the canonical
tool-discovery format; .codex and .copilot views auto-derive via a
Codex-Team-owned read-only derive script. Cross-team edits on shared
files (instructions/, inventory/, wiki/) flow through the existing
baton with a governance-lint warn check. megingjord-coord deprecation
and Dashboard HAMR opt-in (#966) are downstream Epics.

Approved via 3 consecutive SIGN_OFFs (Codex/Copilot/Claude Code) at
rounds 7/8/9 of Epic #922.
