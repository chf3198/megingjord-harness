# Documentation Taxonomy — Diátaxis × Audience × Surface (Epic #3124 D8)

The harness organizes documentation on three axes so every doc has an obvious home and authors know
where new content goes. The cardinal rule (Diátaxis): **do not mix types in one doc** — mixing is the
top cause of confusing documentation.

## Axis 1 — Diátaxis type (by user need)

| Quadrant | Orientation | Answers | Example here |
|---|---|---|---|
| Tutorial | learning | "teach me, step by step" | `docs/howto/getting-started.md` |
| How-to | task | "help me do X" | `docs/howto/*.md` |
| Reference | information | "tell me the facts" | `docs/architecture-*.md`, `config/*` |
| Explanation | understanding | "why is it so" | `ARCHITECTURE.md`, ADRs |

## Axis 2 — Audience

end-user / operator · developer / contributor · AI-agent (reads the *compiled* wiki plane, not raw
docs — see Epic #3124 D1) · public / evaluator.

## Axis 3 — Surface

repo-markdown (source of truth) → projected to web/dashboard, the GitHub profile, and the AI index.
Single-source + projection: author once, render many.

## area:* → required Diátaxis quadrants (machine-readable in `config/doc-coverage-matrix.yml`)

| area label | required quadrants |
|---|---|
| area:hooks | How-to + Reference |
| area:scripts | How-to + Reference |
| area:instructions | Reference + Explanation |
| area:agents | Reference + Explanation |
| area:dashboard | Tutorial + How-to |
| area:knowledge | Explanation + Reference |
| area:governance | Explanation + Reference |
| area:infra | How-to + Reference |

## Canonical entry-point docs (disambiguation)

These pairs are distinct by purpose — each is canonical for its role; they cross-link rather than
duplicate:

- `docs/DECISIONS.md` — canonical **ADR index** (decision records).
- `docs/decisions.md` — canonical **chronological decisions log** (running notes).
- `ARCHITECTURE.md` (repo root) — canonical **architecture overview** (GitHub entry surface).
- `docs/ARCHITECTURE.md` — canonical **detailed architecture reference** (docs-tree depth).

## Scope note

This taxonomy is the organizing schema; it does not rewrite existing docs. Deferred (not in #3131):
a full arc42/C4 restructure and an `llms.txt` discovery index.
