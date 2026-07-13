# Human browse/search + curation surface on the wiki dashboard reader (#3764)

Epic #3719 P1-f. Turns the existing dashboard wiki reader (wisdom-global-only, no search, no curation)
into a browsable + searchable reader across all three wikis and both scopes, plus a low-friction
curation path that writes **only** through the validated write path.

## What ships (`scripts/wiki/dashboard-reader.js`, wired into `scripts/dashboard-wiki.js`)

- `browseWiki({scope, wikiType})` — lists pages across **A=code, B=work-log, C=wisdom** over both the
  **global** (wisdom/global/\*) and **workspace** (wisdom/project, work-log, code) scopes, with scope +
  type filters. A `DIR_MAP` tags every wiki directory with its (type, scope) so the axes are explicit.
- `searchWiki(query, {scope, wikiType, topN})` — ranks the browse candidates through the shipped lexical
  retrieval floor (`retrieval.js#hybridSearch`, BM25 + title + RRF), returning ranked
  `{slug, type, scope, title, score}`, honouring the scope/type filters.
- `curatePage({slug, type, action, content})` — the curation path. `flag-stale` reads the page, injects
  `status: stale` into its frontmatter, and writes it back; `edit` writes new content. **Both route
  through `wiki-io#writePage`** — the ONLY write path — which applies the #3772 credential-class secret
  redaction and the #3763 frontmatter/index update. There is no raw `fs.write` and **no schema bypass**;
  the return object records `via: 'wiki-io.writePage'` so the routing is asserted, not assumed.

The existing `getWikiPages` (wisdom-global-only browse) is preserved unchanged for back-compat.

## Acceptance evidence

- **AC1** — browse spans A/B/C over global + workspace, with scope + type filters; search ranks via the
  lexical floor and honours the scope filter. Unit-tested over a deterministic fixture spanning all four
  page classes (`tests/fixtures/wiki-3764`).
- **AC2** — curation routes through the validated write path: tests assert `via === 'wiki-io.writePage'`,
  that `flag-stale` injects `status: stale`, and that a credential-class secret written via `curatePage`
  is **redacted** on disk (the #3772 write-path guard fires) — i.e. curation cannot bypass the schema /
  redaction. Curation tests write to a fresh tmp copy so the committed fixture is never mutated.
- **AC3** — cross-references **#2508** (the marketplace-extension Epic); this ticket enhances the
  existing in-dashboard reader and does **NOT** supersede or close #2508.

## Tests

`tests/wiki-dashboard-reader.spec.js` (tdd-pyramid, 8/8): browse A/B/C + both scopes, scope filter, type
filter, search ranking, search scope filter, curate flag-stale via-writePage + status:stale, curate edit
secret-redaction (no bypass), and `withFrontmatterFlag` injection.

## Scope

Consumes #3760/#3761 (lexical floor) + #3772/#3763 (validated write path). Additive — the existing reader
behaviour is preserved; no `dashboard/**` UI framework change (the reader API is enhanced, the HTML reader
consumes the new exports). No branch-protection change.
