# llm-wiki-ops — LLM Wiki Operations Skill

## Purpose
Operate and maintain the LLM Wiki knowledge system. Use this
skill when ingesting sources, querying the wiki, diagnosing
health issues, or planning knowledge graph expansion.

## Architecture
```
raw/articles/     → Immutable human-curated sources
wiki/             → LLM-compiled pages (sources/, entities/, concepts/, syntheses/)
wiki/index.md     → Page catalog (updated on every ingest)
wiki/log.md       → Append-only operation log
scripts/wiki/     → CLI tools (ingest, lint, search)
WIKI.md           → Governance schema
```

## Operations

### Ingest
```bash
node scripts/wiki/ingest.js raw/articles/<source>.md
# or: npm run wiki:ingest -- raw/articles/<source>.md
```
Reads raw source → calls OpenClaw LLM → writes wiki/sources/ page.
Updates index.md and log.md. Marks raw source as ingested.

### Lint
```bash
node scripts/wiki/lint.js
# or: npm run wiki:lint
```
Checks: broken [[wikilinks]], orphan pages, missing frontmatter,
index.md sync. Exit 0 = healthy, exit 1 = issues found.

### Search
```bash
node scripts/wiki/search.js "your question here"
# or: npm run wiki:search -- "your question"
```
Keyword scoring → top 5 pages → LLM synthesis via OpenClaw.
Graceful fallback: shows raw matches if LLM unavailable.

## Fleet Routing
- **Ingest**: Fleet lane → OpenClaw (mistral primary, qwen2.5 fallback)
- **Lint**: Free lane → local only (no LLM needed)
- **Search**: Fleet lane → OpenClaw for synthesis

## Failover Chain
OpenClaw(mistral) → OpenClaw(qwen2.5:7b) → Groq → Cerebras

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Ingest timeout | Model cold start | Warm up: `curl OpenClaw/health` |
| All LLMs fail | Network/Tailscale | Check `tailscale status` |
| Orphan pages | No cross-refs | Expected for isolated topics |
| Index drift | Manual wiki edits | Run `npm run wiki:lint` |

## Constraints
- Raw sources are immutable after ingest (status: ingested)
- Wiki pages are LLM-generated — human edits go in raw/
- All scripts ≤100 lines (lint-enforced)
- Timeout: 300s per LLM call (model inference on 16GB RAM)

## Dashboard
Wiki Health panel in Ops view shows: page count, categories,
structural issues. Backed by `/api/wiki-health` endpoint.
