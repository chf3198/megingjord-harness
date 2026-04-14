# Wiki Log

Append-only chronological record of wiki operations.
Each entry uses a parseable prefix for CLI filtering.

## Format

```
## [YYYY-MM-DD] operation | Subject
Brief description of what happened.
```

**Tip**: `grep "^## \[" log.md | tail -5` shows last 5 entries.

---

## [2026-04-13] init | Wiki system scaffolded
Phase 1 foundation created. Directories: raw/, wiki/, scripts/wiki/.
Schema: WIKI.md. No sources ingested yet.
