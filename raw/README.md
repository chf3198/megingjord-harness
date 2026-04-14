# Raw Sources

Curated collection of source documents for the LLM Wiki.
The LLM reads from these but **never modifies them**.

## Structure

```
raw/
├── articles/    # Web articles, blog posts (via Obsidian Web Clipper or manual)
├── papers/      # Research papers, technical reports
├── transcripts/ # Meeting notes, video transcripts, podcast notes
└── clippings/   # Short excerpts, quotes, bookmarks
```

## Rules

- Sources are **immutable** once placed here.
- Use descriptive filenames: `YYYY-MM-DD-slug.md`
- Add YAML frontmatter with at minimum: `title`, `date`, `source_url`
- Large/binary files may be gitignored — add to `raw/.gitignore`
- The LLM will process these via the **ingest** operation.

## Frontmatter Template

```yaml
---
title: "Article Title"
date: 2026-04-13
source_url: https://example.com/article
author: Author Name
tags: [topic1, topic2]
status: pending  # pending | ingested
---
```
