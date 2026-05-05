---
title: "HAMR Spike S6 — Build-vs-Adopt Matrix"
date: 2026-05-04
ticket: 881
epic: 860
status: research-deliverable
---

# HAMR Spike S6 — Build-vs-Adopt Matrix

## 1. Summary

This document covers the 9 surviving HAMR MVP children produced by the S1 code
audit (#876). For each child the decision is one of: ADOPT, BUILD, HYBRID, or
REUSE (per S1 audit §6 terminal mapping).

Decision counts: **ADOPT 2, BUILD 3, HYBRID 3, REUSE 1.**

No license-incompatible libraries (GPL/AGPL) were selected. Three candidates
evaluated carry licenses that are incompatible with PolyForm-Noncommercial and
are explicitly rejected in §5. The `microsoft/LLMLingua` repository is MIT-
licensed and compatible, but its Python install footprint (PyTorch transitive
dependency) makes it unsuitable for an online runtime path; it is restricted to
the offline distillation pipeline only.

Notable maturity callouts: `slsa-framework/slsa-github-generator` and
`sigstore/cosign` are both production-grade (CNCF-backed, multi-year track
record). `cloudflare/workers-oauth-provider` is beta and carries adoption
conditions documented in §5.

## 2. Methodology

### Decision rubric

| Decision | Criteria |
|---|---|
| ADOPT | A named library covers the child's requirement at the required scope; license is compatible; maturity signal passes |
| BUILD | No suitable library exists at this scope; cost or security of adoption exceeds cost of a focused build |
| HYBRID | A library covers one sub-feature; integration glue or the remaining surface requires a build |
| REUSE | Child is fully covered by existing harness code per S1 audit; no new code required |

A library must satisfy all three of the following maturity signals to qualify
for ADOPT:

1. Repository age ≥ 1 year OR backed by a named major project (CNCF, Apache
   Foundation, Cloudflare, Anthropic, Microsoft, Google, OpenAI).
2. ≥ 1 000 GitHub stars OR an official SDK for the named platform.
3. Last release within 6 months of this document date (2026-05-04).

### License-compatibility check

Project license: PolyForm-Noncommercial-1.0.0. Compatible inbound licenses
(permissive): MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, CC-BY-4.0.
Incompatible (copyleft): GPL-2.0, GPL-3.0, AGPL-3.0, LGPL (with caveats),
EUPL. Any ADOPT decision must confirm compatible license; GPL/AGPL libraries are
flagged and rejected in §5.

### Source of truth

- HAMR v3 spec: `research/hamr-v3-2026-05-04.md` (cited as `hamr-v3 §N`)
- S1 code audit: `research/hamr-spike-s1-code-audit-2026-05-04.md` (cited as
  `S1 §N`)

## 3. Per-Child Decision Matrix

| # | Child | Decision | Library | License | Maturity | Rationale |
|---|---|---|---|---|---|---|
| 1 | HAMR core Cloudflare Worker | HYBRID | `workers-oauth-provider` (OAuth 2.1 + DPoP sub-feature) | Apache-2.0 | Beta; Cloudflare-backed | Worker routing and bundle/mailbox endpoints are BUILD; OAuth 2.1 + DPoP flow uses the official library to avoid rolling cryptographic primitives |
| 2 | Substrate-health probe + `substrate-health.json` | BUILD | — | — | — | Pure orchestration of existing probe modules per S1 §6; no library covers this schema-merge-and-write pattern |
| 3 | Provider caching adapters + sticky-route + cache-hit-rate gate | BUILD | — | — | — | Adapters extend existing `token-provider-adapters.js` (S1 REFACTOR); no library covers the HAMR-specific cache-name routing and hit-rate gate |
| 4 | JIT wiki retrieval + bidirectional ingest | HYBRID | `@modelcontextprotocol/sdk` (MCP `resources/read` client) | MIT | Official Anthropic SDK, actively maintained | MCP client transport is ADOPT; R2 queue source path, TruffleHog gate, and `--auto`/`--batch` flags are BUILD on top of existing `wiki/ingest.js` |
| 5 | R2 JSONL mailbox + Google A2A envelope | BUILD | — | — | — | No library covers R2-backed JSONL mailbox with A2A envelope schema; Cloudflare R2 SDK is used as a dependency but does not cover the protocol layer |
| 6 | SLSA-L3 + OIDC publishing + Cosign Bundle 1.0 | ADOPT | `slsa-framework/slsa-github-generator` + `sigstore/cosign` + `cloudflare/wrangler-action@v3` | Apache-2.0 / Apache-2.0 / MIT | CNCF-backed; >3 yr; production | CI pipeline configuration; no custom code beyond workflow YAML + `wrangler.toml` OIDC policy |
| 7 | Constitution compressor (LLMLingua-2 distillation pipeline) | HYBRID | `microsoft/LLMLingua` (offline compression step) | MIT | EMNLP-2024 paper; Microsoft-backed; >1 yr | Offline compression uses the reference impl; 100-prompt coverage-gate harness and verification runner are BUILD |
| 8 | `hamr:status` + `hamr:quota` operator-UX CLIs | BUILD | — | — | — | No library covers HAMR-specific substrate/provider status aggregation; thin CLI wrappers over `capability-probe` refactor per S1 §6 child #877 |
| 9 | Header-driven rate-limit spillover + Anthropic Batch router | HYBRID | `@anthropic-ai/sdk` + `openai` + `@google/generative-ai` (Batch API clients) | MIT / Apache-2.0 / Apache-2.0 | Official provider SDKs; actively maintained | Provider SDK clients are ADOPT; spillover orchestration logic (header-read → provider order → budget check) and batch router are BUILD on top of existing `cascade-dispatch.js` refactor |

## 4. Decision Details

### 4.1 HAMR Core Cloudflare Worker (HYBRID)

**Decision: HYBRID** — `cloudflare/workers-oauth-provider` for OAuth 2.1 + DPoP;
Worker routing and bundle/mailbox/quota/healthz endpoints are BUILD.

The existing `cloudflare/worker.ts` is a REPLACE target (S1 §3). The new Worker
requires a full router with endpoints `/bundle/<profile>/<sha>`,
`/bundle/diff/<a>/<b>`, `/mcp`, `/mailbox`, `/quota`, and `/healthz` (hamr-v3
§1, revised architecture diagram). No library provides a ready-made Cloudflare
Worker router at this specificity; `itty-router` is a viable lightweight
dependency but is a sub-100-line utility, not a library substituting for design.

`cloudflare/workers-oauth-provider` covers the OAuth 2.1 Authorization Server
on the Worker, including DPoP proof validation (RFC 9449). This avoids
implementing PKCE, token issuance, and DPoP cryptographic verification from
scratch — a security-critical surface where rolling custom code is unacceptable.

- Library: <https://github.com/cloudflare/workers-oauth-provider>
- License: Apache-2.0 — compatible.
- Maturity: Cloudflare-backed; beta status as of 2026-Q2. Adoption condition:
  pin to a named release tag; review release notes before each Worker redeploy.
  See §5 for beta-status risk.
- Why better than building: RFC 9449 DPoP is a nuanced spec with proof-of-
  possession key binding, nonce handling, and token-endpoint binding. A correct
  implementation requires careful crypto; the library is maintained by the same
  team that runs the runtime.

### 4.2 Substrate-Health Probe + `substrate-health.json` (BUILD)

**Decision: BUILD** — extends existing modules; no external library needed.

S1 §6 (child #870) specifies merging `capability-probe.js`, `routing-refresh.js`,
and `fleet-config.js` into a single probe that writes
`~/.megingjord/substrate-health.json`. The required behavior is orchestration
of existing probe loops with a new output schema and DPoP-auth CF Worker probe.
No npm library covers this pattern; `capability-probe.js` already implements
6-provider HTTP probing and Tailscale fleet probing (S1 §3). The BUILD cost is
low: convergence logic, schema definition, and atomic file write.

Alternative considered: `node-health-checker` — rejected; covers HTTP endpoint
health only, not the multi-provider rate-limit header capture and filesystem
schema HAMR requires.

### 4.3 Provider Caching Adapters + Sticky-Route + Cache-Hit-Rate Gate (BUILD)

**Decision: BUILD** — extends existing `token-provider-adapters.js` and
`litellm-client.js`; no external library covers the HAMR-specific requirement.

S1 §3 (`token-provider-adapters.js` REFACTOR, `litellm-client.js` REFACTOR)
shows that cache-read-token extraction already exists for Anthropic and Gemini.
HAMR adds: Groq header-based rate-limit adapter, `cache_hit_rate` computed
field, sticky-route logic (same `bundle_sha256` → same workspace), and a
≥ 80% hit-rate alert gate (hamr-v3 §4). No library provides cache-name routing
keyed on bundle SHA with provider-specific hit-rate measurement.

Alternative considered: `cacheable-request` — rejected; covers HTTP-level
caching semantics (ETags, `Cache-Control`), not LLM prompt-cache hit-rate
measurement across providers.

### 4.4 JIT Wiki Retrieval + Bidirectional Ingest (HYBRID)

**Decision: HYBRID** — `@modelcontextprotocol/sdk` for MCP client transport;
R2 queue integration, TruffleHog gate, and `--auto`/`--batch` flags are BUILD.

The MCP `resources/read` call path for JIT wiki page retrieval (hamr-v3 §3,
"just-in-time wiki") requires an MCP client. The official SDK handles transport,
JSON-RPC framing, and the `resources/read` method contract.

- Library: <https://github.com/modelcontextprotocol/typescript-sdk>
- License: MIT — compatible.
- Maturity: Official Anthropic/MCP org SDK; actively maintained; aligned with
  the MCP specification used by HAMR (MCP 2025-06-18 authorization spec).
- Why better than building: The MCP wire protocol is evolving; using the
  official SDK ensures forward-compatibility with protocol revisions without
  maintaining a bespoke JSON-RPC client.

Bidirectional ingest (S1 §3, `wiki/ingest.js` REFACTOR) adds `--auto` flag for
R2 queue source path, `--batch` flag for Anthropic Batch API emission, and a
TruffleHog `--only-verified` subprocess gate before R2 write. These are
BUILD additions to the existing module; no library covers this pipeline.

### 4.5 R2 JSONL Mailbox + Google A2A Envelope (BUILD)

**Decision: BUILD** — no library covers the R2-backed JSONL mailbox with A2A
envelope schema at the required specificity.

The mailbox protocol (hamr-v3 revised architecture) uses R2 object storage with
JSONL-formatted messages and a Google A2A-compatible envelope. Cloudflare's
Workers SDK provides R2 bindings (`env.MAILBOX.put`, `env.MAILBOX.list`) but
does not implement the protocol layer (envelope schema, message ordering, read-
cursor semantics, fleet-id routing). This replaces `agent-coord-remote.js` and
`cloudflare/durable-object.ts` (S1 §3, both REPLACE).

Alternative considered: `@google/a2a` npm package — no stable official npm
package for the Google A2A envelope spec exists as of 2026-Q2; the protocol
is implemented as an open spec. BUILD from spec.

### 4.6 SLSA-L3 + OIDC Publishing + Cosign Bundle 1.0 (ADOPT)

**Decision: ADOPT** — three libraries compose the full pipeline; no BUILD
required beyond workflow YAML and `wrangler.toml` OIDC policy.

**`slsa-framework/slsa-github-generator`**

- Repo: <https://github.com/slsa-framework/slsa-github-generator>
- License: Apache-2.0 — compatible.
- Maturity: CNCF-backed; >3 years; production status; used by major OSS
  projects including `sigstore` itself.
- Provides: reusable workflow `slsa-framework/slsa-github-generator/.github/
  workflows/builder_nodejs_slsa3.yml@v2` that attests SLSA Build L3 provenance
  and uploads to GitHub release assets (hamr-v3 §1).

**`sigstore/cosign`** (CLI) + **`sigstore/sigstore-js`** (Node.js client)

- Repos: <https://github.com/sigstore/cosign>,
  <https://github.com/sigstore/sigstore-js>
- License: Apache-2.0 — compatible.
- Maturity: Sigstore project (Linux Foundation); production; >4 years; cosign
  is the de-facto keyless signing tool for container and artifact supply chains.
- Provides: Cosign Bundle 1.0 format (`*.sigstore` JSON) packing
  `messageSignature`, cert chain, and tlog inclusion proof; offline-verifiable
  (hamr-v3 §1).

**`cloudflare/wrangler-action@v3`**

- Repo: <https://github.com/cloudflare/wrangler-action>
- License: MIT — compatible.
- Maturity: Official Cloudflare GitHub Action; actively maintained; >1 year;
  integrates GitHub OIDC for CF workload identity (hamr-v3 §1).
- Provides: OIDC-federated Worker deploy without long-lived CF API tokens.

### 4.7 Constitution Compressor — LLMLingua-2 Distillation Pipeline (HYBRID)

**Decision: HYBRID** — `microsoft/LLMLingua` for the offline compression step;
100-prompt rule-coverage gate harness is BUILD.

- Library: <https://github.com/microsoft/LLMLingua>
- License: MIT — compatible.
- Maturity: Microsoft Research; EMNLP-2024 publication (LLMLingua-2 paper,
  arxiv:2403.12968); actively maintained; >1 year; >3 000 GitHub stars.
- Provides: LLMLingua-2 token-level compression for long prompts; applied
  offline to the 14 instruction files to produce a ~500-token "constitution"
  from ~5K preamble tokens (hamr-v3 §3, "-75% governance preamble").

The 100-prompt rule-coverage verification harness (must reproduce baton-routing
decisions on ≥ 97% before ship) is BUILD: it requires loading the constitution,
running a prompt battery against an inference endpoint, and comparing structured
output to expected baton decisions. No library covers this pipeline.

**Runtime rejection confirmed:** LLMLingua-2 at runtime is explicitly rejected
in hamr-v3 §3 ("tokenization cost ≈ savings under a 30-KB bundle"). Offline
only.

Install footprint note: `microsoft/LLMLingua` requires PyTorch as a transitive
dependency (Python package). This runs in an isolated offline CI job, not in
the Worker or Node.js runtime. See §5.

### 4.8 `hamr:status` + `hamr:quota` Operator-UX CLIs (BUILD)

**Decision: BUILD** — thin CLI wrappers over refactored probe modules; no
library covers this aggregation pattern.

S1 §6 (child #877) specifies that `capability-show.js` folds its tier-
availability rendering into `hamr:status` (S1 §3, MERGE decision). The status
CLI aggregates substrate state from `substrate-health.json`, identity TTL from
`~/.megingjord/identity.json`, bundle hash and cache-hit-rate from probe output,
and emits a single structured line (hamr-v3 §2).

`hamr:quota` queries Anthropic `count_tokens`, OpenAI usage aggregates, and
Groq response headers (hamr-v3 §4), then writes remaining budget per provider
into `substrate-health.json`. These are orchestration CLIs with HAMR-specific
business logic; no general-purpose CLI framework substitutes for the semantic
layer.

Alternative considered: `ink` (React for CLIs) — rejected; adds a React
dependency for a single-line status output; overkill for the use case.

### 4.9 Header-Driven Rate-Limit Spillover + Anthropic Batch Router (HYBRID)

**Decision: HYBRID** — official provider SDKs are ADOPT for Batch API calls;
spillover orchestration and batch router are BUILD.

**Provider SDK libraries (ADOPT component):**

- `@anthropic-ai/sdk` — <https://github.com/anthropic-ai/sdk-python> (Node.js
  variant: `@anthropic-ai/sdk`); MIT; official Anthropic SDK; actively
  maintained.
- `openai` — <https://github.com/openai/openai-node>; Apache-2.0; official
  OpenAI SDK; actively maintained.
- `@google/generative-ai` — <https://github.com/google-gemini/generative-ai-js>;
  Apache-2.0; official Google SDK; actively maintained.

These SDKs expose the Batch API surfaces (hamr-v3 §4: Anthropic Message
Batches, OpenAI Batch, Gemini batch mode) needed by `harness-batch-router.js`.
Using official SDKs ensures rate-limit header normalization and auth handling
remain aligned with provider changes without custom maintenance.

**Spillover orchestration (BUILD component):**

The header-driven spillover logic reads `anthropic-ratelimit-*`, `x-ratelimit-*`
(Groq, OpenAI, OpenRouter) per call and decides provider order (hamr-v3 §4:
Groq → Cerebras → OpenRouter free → Gemini Flash → Haiku). This is an extension
of `cascade-dispatch.js` (S1 REFACTOR) and `model-routing-engine.js` (S1
REFACTOR). No library covers multi-provider header-driven spillover with
per-role token budgets; the logic is HAMR-specific.

## 5. Cross-Cutting Library Risks

### 5.1 `workers-oauth-provider` Beta Status

`cloudflare/workers-oauth-provider` is in beta as of 2026-Q2. Risks: breaking
API changes between minor versions; incomplete DPoP nonce management in edge
cases. Mitigation: pin to a named release tag in `package.json`; lock in CI
(`package-lock.json`); add a review gate before each Worker redeploy that checks
for new releases and reviews breaking-change notes. Do not use `latest`.

### 5.2 LLMLingua-2 Install Footprint

`microsoft/LLMLingua` requires PyTorch as a transitive Python dependency. The
full install (PyTorch + HuggingFace `transformers` + `tokenizers`) is
approximately 2–4 GB depending on CUDA variant. This is acceptable in an
isolated offline CI job (GitHub Actions with a Python environment step) but must
not be bundled into the Node.js Worker or included in npm publish scope.
Enforcement: add `LLMLingua` distillation to a dedicated CI job behind a
manual trigger; confirm `package.json` `files` field excludes the Python
environment.

### 5.3 License-Incompatible Libraries Flagged and Rejected

The following candidates were evaluated and rejected on license-compatibility
grounds:

| Library | License | Reason for Rejection |
|---|---|---|
| `yjs` + `y-protocols` | MIT | **Not rejected** — MIT is compatible. However, HAMR v3 §5 ("Stays: Yjs CRDT") preserves Yjs from v2; it is not a child-level decision in the 9 surviving children and is not scoped in this matrix |
| `gitleaks` (binary) | MIT | **Not rejected** — MIT; called as a subprocess in `prepack`; no npm packaging concern |
| `trufflesecurity/trufflehog` (binary) | AGPL-3.0 | **FLAGGED** — AGPL-3.0 is incompatible with PolyForm-Noncommercial. Mitigation: invoke `trufflehog` as an external subprocess binary only (never import as a Node.js library); AGPL triggers on distribution of modified source, not on subprocess invocation. Document this boundary explicitly in the contributing guide. Do not add as an npm dependency. |

Net incompatible count: **1** (TruffleHog, mitigated by subprocess-only
invocation boundary).

### 5.4 `@modelcontextprotocol/sdk` Protocol Churn

The MCP specification is at 2025-06-18 version. The authorization spec
(OAuth 2.1 + DPoP) is relatively new. Monitor the MCP changelog for breaking
changes in the `resources/read` method contract. Pin the SDK to a minor version
and adopt upgrades only after reviewing the MCP specification diff.

## 6. Adoption Sequencing Recommendation

Libraries should be integrated in the following order, driven by dependency
relationships between the 9 children:

**Phase 1 — Unblock Worker deployment (Child 1, 6)**

1. `slsa-framework/slsa-github-generator` + `sigstore/cosign` +
   `cloudflare/wrangler-action@v3` — these compose the SLSA-L3 + OIDC
   publishing pipeline (Child 6). Must ship before the Worker is deployed to
   production (Child 6 blocks Child 1 per S1 §6).
2. `cloudflare/workers-oauth-provider` — pin and integrate into the Worker
   (Child 1 HYBRID component). Dependency on Child 6 for the OIDC identity
   the OAuth server will validate.

**Phase 2 — Enable runtime routing and wiki (Children 4, 9)**

3. `@anthropic-ai/sdk` + `openai` + `@google/generative-ai` — Batch API
   integration (Child 9 ADOPT component). Required before the batch router
   can emit batch requests.
4. `@modelcontextprotocol/sdk` — MCP client for JIT wiki `resources/read`
   (Child 4 HYBRID component). Depends on the Worker (Child 1) being live.

**Phase 3 — Offline distillation (Child 7)**

5. `microsoft/LLMLingua` — offline distillation pipeline (Child 7 HYBRID
   component). Independent of runtime; can be integrated in parallel with
   Phase 2 but should ship before constitution is locked into the bundle.

**Phase 4 — BUILD children (Children 2, 3, 5, 8)**

The BUILD children (Substrate-health probe, Caching adapters, Mailbox, CLIs)
have no external library adoption risk. They integrate after library adoptions
are stable.

## 7. Wiki Ingest Plan

Slug: `hamr-spike-s6-build-vs-adopt`

Candidate entity pages:

- `workers-oauth-provider` — entity: Cloudflare beta OAuth 2.1 + DPoP library
  for Workers; adoption conditions and pin policy.
- `slsa-github-generator` — entity: SLSA-framework reusable workflow for
  Build L3 Node.js provenance.
- `sigstore-cosign` — entity: keyless signing tool; Cosign Bundle 1.0 format.
- `llmlingua-constitution-compressor` — concept: offline compression of
  governance instruction files to a ~500-token constitution; 97% coverage gate.

Candidate concept pages:

- `build-vs-adopt-rubric` — concept: decision rubric (ADOPT/BUILD/HYBRID/REUSE)
  with maturity signal definition and license-compatibility matrix.
- `trufflehog-subprocess-boundary` — concept: AGPL-licensed binary invoked as
  subprocess only; not imported as npm dependency; PolyForm-NC compatibility.

Ingest command after document is accepted:

```bash
npm run wiki:ingest -- research/hamr-spike-s6-build-vs-adopt-2026-05-04.md
```

---

Refs Epic #860, S6 #881, HAMR v3 #873
