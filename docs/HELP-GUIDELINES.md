# HELP Panel UX Guidelines

The Megingjord dashboard HELP panels are composed of two JavaScript files in
`dashboard/js/`: `help-user.js` (task-oriented operator help) and `help-dev.js`
(developer/architecture help). Each file exports an array of section objects
with shape `{ id, title, body }` consumed by `renderHelpPanel()` in
`help-content.js`.

## Section ID prefix taxonomy

Every section's `id` must use one of these prefixes so the renderer can group
sections into the correct help category:

- `start-*` — orientation and dashboard tour (e.g. `start-what`, `start-tour`)
- `use-*` — operator workflow per panel (e.g. `use-baton`, `use-governance`)
- `trouble-*` — troubleshooting recipes (e.g. `trouble-offline`, `trouble-stale`)
- `dev-*` — developer / architecture / skill-development (`help-dev.js` only)

## Body-string conventions

Body strings are HTML fragments rendered via `x-html` after passing through
`renderWikiLinks()`. Use these patterns consistently:

- `<strong>` — nouns and UI labels (panel names, button names, status terms)
- `<em>` — inline emphasis and the wikilink suffix
- `<code>` — file paths, shell commands, and `npm run` invocations
- `<br>` — line breaks **within** a body string (avoid block elements)
- `<em>Learn more: [[wiki-page]]</em>` — canonical wikilink-suffix pattern

The `[[wiki-page]]` token is transformed to a clickable Alpine-wired anchor
that switches the dashboard to Wiki view.

## When to add to which file

- `help-user.js` — anything an operator does to monitor or operate the fleet.
  Reading panels, running stress tests, troubleshooting offline devices.
- `help-dev.js` — anything that requires editing this repo: architecture,
  contribution flow, skill development, file structure, API endpoints.

If a section is useful to both audiences, prefer `help-user.js` and link from
`help-dev.js` via wikilink rather than duplicating the body.

## File-size discipline

The repo lint rule (`scripts/lint.js`) enforces ≤100 lines per file. When a
help file approaches 90 lines, split by topic into a new file (e.g.
`help-troubleshooting.js`) and add the corresponding `<script>` tag to
`dashboard/index.html` and the new `HELP_*_SECTIONS` constant import in
`help-content.js`.

## Wikilink discipline

Only reference wiki pages that exist in `~/.copilot/wiki/concepts/` or
`~/.copilot/wiki/entities/`. The `docs-lint` CI gate (#722) fails on any
broken wikilink. Run `npm run docs:lint` locally before committing.

To check available pages: `npm run help:topic -- <term>`.

## Section ordering

Within each file, group sections by their id-prefix family in the order
declared above (start, use, trouble, dev). The renderer concatenates files in
order so consistent grouping yields predictable category collapse.

## Avoid

- Block elements (`<div>`, `<ul>`, `<ol>`) in `body` — they break category-summary collapse
- Inline `<a href>` to external URLs — use wikilinks; if external is unavoidable, render via `renderHelpPanel`'s feedback footer
- Markdown syntax — bodies are HTML fragments, not markdown
- Hard-coded fleet IPs or credentials — those belong in `inventory/`, not help text

## Testing changes

```
npm run lint        # ≤100-line check
npm run docs:lint   # HELP↔script and HELP↔wiki drift
npm start           # Open dashboard, click "📘 Help" view, verify rendering
```
