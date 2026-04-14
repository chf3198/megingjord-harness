---
title: "Karpathy LLM Wiki Pattern"
date: 2026-04-13
source_url: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
author: Andrej Karpathy
tags: [llm-wiki, knowledge-management, obsidian, compilation]
status: ingested
---

# Karpathy LLM Wiki Pattern

The LLM Wiki is a pattern for building personal knowledge bases using LLMs.
Instead of retrieval (RAG), the LLM **compiles** knowledge into a persistent
wiki of interlinked markdown files.

## Architecture

Three layers:
- **Raw sources** — immutable, human-curated documents
- **Wiki** — LLM-generated markdown (summaries, entities, concepts)
- **Schema** — governance conventions (CLAUDE.md or AGENTS.md)

## Operations

- **Ingest**: Drop source → LLM reads, summarizes, cross-references
- **Query**: Ask questions → LLM reads index, synthesizes answer
- **Lint**: Health-check for contradictions, orphans, stale claims

## Key Insight

"Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase."
The human curates sources and asks questions. The LLM does all bookkeeping.

## Community

5000+ stars, 3800+ forks. Implementations include wiki-kb, CacheZero,
Memoriki, Cortex, SwarmVault. Key debate: model collapse risk.
