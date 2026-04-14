# ADR-007: LLM Wiki Knowledge System Adoption

**Status**: Accepted
**Date**: 2026-04-13

## Context

Knowledge about the devenv-ops fleet, skills, services, and research is
scattered across 33 skills, 12 instructions, 5 ADRs, inventory JSON,
and dashboard code. There is no compiled, cross-referenced knowledge
layer. Each agent session re-derives context from scratch — the same
pattern Karpathy identified as the weakness of RAG-only approaches.

Karpathy's [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
(5000+ ⭐, April 2026) proposes a different model: the LLM incrementally
builds and maintains a persistent wiki of interlinked markdown files.
Knowledge is compiled once, kept current, and compounds over time.

## Decision

Adopt the LLM Wiki pattern with three layers:

1. **Raw sources** (`raw/`) — immutable, human-curated documents
2. **Wiki** (`wiki/`) — LLM-written markdown with entities, concepts,
   source summaries, syntheses, index, and log
3. **Schema** (`WIKI.md`) — governance conventions co-evolved by
   human and LLM

Use Foam (VS Code extension) over Obsidian for graph viewing to
avoid the 200-600MB RAM cost on the 2.7GB Chromebook. This decision
is reversible — both use standard markdown + wikilinks.

Route inference through OpenClaw (free, local 7B models) with
Groq/Cerebras failover. Reserve Copilot Pro for complex synthesis.

## Alternatives Considered

| Alternative | Why Not |
|---|---|
| Pure RAG (ChatGPT uploads, NotebookLM) | No accumulation, re-derives every query |
| Cortex (OWL-RL ontology + SPARQL) | Powerful but heavyweight for our scale |
| SwarmVault | Full framework — more than we need initially |
| Obsidian-native on penguin-1 | 200-600MB RAM, marginal on 2.7GB device |

## Consequences

- **Pro**: Compiled knowledge compounds — cross-refs maintained by LLM
- **Pro**: Zero new infrastructure — plain markdown files in git
- **Pro**: Fits existing deploy/sync workflow (same as skills)
- **Pro**: Fleet utilization — penguin-1 orchestrates, OpenClaw infers
- **Con**: Schema design is iterative — will evolve with use
- **Con**: Token cost scales with wiki size (mitigated by index-first)
- **Con**: Risk of model collapse (mitigated by typed frontmatter lint)
