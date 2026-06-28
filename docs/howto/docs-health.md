# docs:health — periodic prose-doc health scan

`npm run docs:health` scans **non-wiki PROSE doc surfaces** (`docs/`, `instructions/`,
`governance/`, and root agent + community markdown) for two debt signals the
merge-time `doc-coverage` gate structurally cannot see:

- **Orphans** — a prose doc that *nothing anywhere in the tree references* (no markdown
  link, no inline path mention in `CLAUDE.md` / instructions / a script comment, no
  `[[wikilink]]`). `doc-coverage` only fires on **changed** PRs, so an untouched orphan
  is invisible to it forever. This scan makes it visible.
- **Stale** — a doc whose last-commit age exceeds the `freshness_window` declared for its
  surface in the owner map.

It is the prose analogue of [`wiki:health`](../../scripts/wiki/wiki-health-detector.js)
(#3068): same per-store health-vector shape, same schema-v3 G8 event emission to
`dashboard/events.jsonl`, same advisory→blocking-is-replay-eval-gated promotion model.

## The owner map (`config/doc-health-owners.yml`)

This map is the **ownership + freshness** half of the #2708 freshness policy. The
**trigger** half — *which code change requires which doc update* — already lives in
[doc-update-trigger-matrix.md](doc-update-trigger-matrix.md); together they complete
the #2708 owner-map deliverable.

Each entry is an ordered, first-match-wins glob → `{ owner, freshness_window }`:

- `owner` — the baton role accountable for that surface's currency
  (`manager | collaborator | admin | consultant`).
- `freshness_window` — `7d | 14d | 30d | 90d | 180d | none`. This is a per-surface
  **content** property (it mirrors the wiki frontmatter `freshness_window` contract);
  `none` = intentionally archival (CHANGELOG, ADRs) and exempt from the stale check.
  It is **not** a process-promotion calendar threshold — the advisory→blocking
  promotion of this scan stays replay-eval-gated, never calendar-based.

`orphan_exempt` lists the index/entrypoint docs (READMEs, the agent-instruction quartet)
that legitimately have no inbound reference and must never be flagged.

## Scope boundary (do not reopen the audit #3296 seam)

This scan covers **prose only**. `skills/**/SKILL.md`, `agents/**`, and
`.claude/commands/*.md` are **eval-harness prompt artifacts**, not prose — their git
edit-date is *not* a doc-rot signal. Their structural quality (broken links, malformed
frontmatter, stubs) is governed separately by the prompt-artifact linter (#3302). Keep
the two strictly apart.

## Usage

```bash
npm run docs:health              # human-readable summary + offender list
npm run docs:health -- --json    # full per-doc records + rollup metrics
npm run docs:health -- --strict  # exit 2 when not ok (for opt-in CI promotion)
```

The detector core (`scan`, `classify`, `buildReferencedSet`) is pure with injectable
corpus / haystack / age inputs, so it is zero-cost and testable without any git or
provider call (`tests/docs-health-detector.spec.js`).
