---
name: Team & Model Signing Governance
description: Require AI-authored governance artifacts to carry human alias plus structured team/model provenance across tickets, git, PRs, and documentation.
applyTo: "**"
---

# Team & Model Signing Governance

## Canonical rule

- Every governed AI-authored artifact carries:
  - `Signed-by: <human-alias>`
  - `Team&Model: <team>:<model>@<substrate>[/<device>]`
  - `Role: manager|collaborator|admin|consultant`
- Use `Device` only when execution ran on a named fleet target or remote gateway.

## Source of truth

- Structured `Team&Model` provenance is authoritative.
- Human aliases are display-friendly and must remain deterministic from team + model + role.
- `inventory/team-model-signatures.json` is the shared alias registry consumed by `scripts/global/agent-signature.js`.
- Repo-local governance may extend or tighten the format, but may not remove team/model provenance.

## Required surfaces

- GitHub issue comments for baton artifacts, blocker notes, and exception evidence.
- PR descriptions and release/closeout evidence.
- AI-authored governance, design, or research docs.
- AI-authored commits should include structured trailers when the toolchain permits.

## Git trailer contract

- `AI-Signature: <human-alias>`
- `AI-Team-Model: <team>:<model>@<substrate>[/<device>]`
- `AI-Role: <role>`
- Commit subject/body rules still follow repo commit policy; issue linkage `#N` remains mandatory.

## Alias derivation

- Given name derives from team + model family.
- Match the first registry entry whose team/model pattern and optional device pattern fit.
- Surname derives from active Agile role.
- Current role surnames: Manager=`Mason`, Collaborator=`Harper`, Admin=`Reyes`, Consultant=`Vale`.
- Use `node scripts/global/agent-signature.js` when you need deterministic output.

## Override rule

- Repo-local governance may narrow or extend the global scheme.
- When local rules differ, use the local alias/trailer format and keep canonical `Team&Model` provenance present.
