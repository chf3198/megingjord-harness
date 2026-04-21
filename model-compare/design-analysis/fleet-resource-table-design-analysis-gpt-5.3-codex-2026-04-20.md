# Fleet Resource Table Design Analysis (GPT-5.3-Codex)
**Date**: 2026-04-20
**Last-updated**: 2026-04-20T00:00:00Z
**Status**: Temporary analysis artifact

## Summary Table
| Area | Prior suggestion | Critical assessment | Recommendation |
|---|---|---|---|
| Table schema | Wide, feature-rich table | Risk of horizontal overflow and low scannability | Use a strict core-column set + expandable row details |
| Auto-update orchestration | Multi-LLM + reviewer + auto-commit | Strong quality potential but high complexity/cost/failure surface | Phase rollout: single strict pipeline first, then add consensus tier |
| Prompt-builder | Code-generated prompts | Correct approach; must be versioned and testable | Prompt templates with schema-version pin + golden tests |
| JSON validation + resubmit | Retry loop per model | Correct; can loop on semantic errors | Two-stage validation: schema validation + semantic validators |
| Review layer | Third LLM reviewer | Good for confidence, weak if no deterministic gates | Reviewer is advisory; deterministic policy engine remains final gate |
| Secret editing UX | Lock/unlock + per-resource modal | Good governance; poor if session lock state leaks | Default lock on every render + short unlock TTL + audit log |
| Credential storage | Vault preferred | Correct industry standard | Vault KV v2 with least-privilege token + rotation workflow |
| Commit policy | Automated commits | Useful but risky for structural changes | Auto-commit low-risk deltas; PR-required for schema/table-structure changes |

## Actions Performed
1. Reviewed repository research/doc instructions and wiki operation conventions.
2. Reviewed local Karpathy wiki content for routing/context/governance alignment.
3. Performed external web research on:
   - Structured outputs + strict schema controls
   - Tool-use consistency and output-guardrail patterns
   - Enterprise secret management baseline
4. Synthesized critical design tradeoffs and failure modes.

## Internal Karpathy Wiki Utilization
Used internal wiki pages as grounding context before conclusions:
- `wiki/concepts/model-routing.md`
- `wiki/concepts/context-flow.md`
- `wiki/sources/karpathy-llm-wiki-pattern.md`
- `WIKI.md` schema conventions and ingest/query/lint flow

## External Research (Cutting-edge references)
### Structured output and deterministic schema conformance
- OpenAI: Structured Outputs + strict JSON schema + refusal handling + schema subset constraints.
  - https://openai.com/index/introducing-structured-outputs-in-the-api/
  - https://developers.openai.com/api/docs/guides/structured-outputs
  - https://developers.openai.com/api/docs/guides/function-calling
- Google Gemini: response_json_schema + schema subset + semantic validation caveat.
  - https://ai.google.dev/gemini-api/docs/structured-output
- Vertex AI MaaS: structured output support for open models and JSON-mode caveat.
  - https://docs.cloud.google.com/vertex-ai/generative-ai/docs/maas/capabilities/structured-output

### Consistency and guardrail patterns
- Anthropic: strict tool use and output consistency guardrail patterns.
  - https://platform.claude.com/docs/en/docs/agents-and-tools/tool-use/overview
  - https://platform.claude.com/docs/en/docs/test-and-evaluate/strengthen-guardrails/increase-consistency

### Secret management baseline
- HashiCorp Vault docs (industry-standard secret lifecycle, access control, auditability).
  - https://developer.hashicorp.com/vault/docs

## Critical Analysis of Prior Suggestions
## 1) Fleet Resource Table format
### What was good
- Included governance-relevant metadata (status, validation, last-used, credential requirement).
- Included per-row edit affordance and links to source/validation.

### What was weak
- Too many always-visible columns create the exact horizontal-scroll problem reported by client.
- "Everything in one row" reduces decision speed and increases visual noise.

### Better table format (recommended)
Use a **core + details** approach.

### Core columns (always visible)
1. Resource
2. Type
3. Status
4. Credential State (Configured / Missing / Invalid)
5. Last Checked
6. Action (Edit)

### Row details (expando panel or modal preview)
- Models/capabilities
- Cost/tier
- Validation details
- Source URLs
- Last error
- Audit history summary

This preserves governance visibility while preventing overflow.

## 2) Auto-update architecture
Client idea (from the client) is strong: prompt-builder -> multi-LLM JSON -> validator/resubmission -> secondary LLM review -> approved table update.

### What is excellent
- Explicit JSON schema contract.
- Redundant model generation to reduce single-model blind spots.
- Secondary review layer before changes are accepted.

### Risks if implemented naively
1. **Complexity explosion**: many moving parts increase outage probability.
2. **Correlated model errors**: multiple LLMs may share same wrong source assumption.
3. **Retry storms**: schema/semantic mismatch can create repeated expensive retries.
4. **Auto-commit blast radius**: bad but schema-valid changes can still enter main.

### Recommended control model
- **Stage A (deterministic minimum viable):**
  1) prompt-builder
  2) 2-model research pass
  3) strict schema validation
  4) semantic validators (URLs resolve, model IDs normalized, numeric ranges valid)
  5) policy gate
  6) commit
- **Stage B (enhanced):** add 3rd reviewer model and confidence scoring.

This preserves the client’s architecture while reducing near-term risk.

## 3) Validation strategy (must-have)
Use two independent layers:
1. **Syntactic layer**: JSON schema strict validation.
2. **Semantic layer**: deterministic code validators for business rules.

Suggested semantic checks:
- `provider` in allowlist
- `status` enum fixed
- `sourceUrls` reachable (HTTP 200/3xx)
- `models[].id` non-empty, unique within provider
- quota/cost fields parseable
- last-seen timestamps monotonic

On failure: resubmit with machine-generated diff/error payload to same model (max 3 retries), then failover model.

## 4) Review-layer design
Reviewer LLM should be **advisory**, not authoritative.
Final acceptance should come from deterministic policy gates.

Reviewer tasks:
- Detect suspicious removals/additions
- Flag abrupt quota changes
- Summarize confidence and unresolved conflicts

Policy engine tasks:
- Block structural schema changes
- Block >X% resource deletions in one run unless approved
- Block missing mandatory fields

## 5) Auto-commit policy
Client requested automated commits; keep it, but classify risk:
- **Low risk (auto-commit):** status flips, timestamps, non-structural metadata
- **Medium risk (auto-commit + alert):** model additions within existing provider schema
- **High risk (PR-required):** schema changes, mass deletions, credential-field changes

## 6) User-editing and credentials
### Recommended UX flow
1. View renders locked every time.
2. User unlocks with short-lived auth proof.
3. Edit icon enabled for credentialed rows only when unlocked.
4. Resource-type modal validates credentials server-side.
5. Save writes to Vault path per resource.
6. View auto-locks after save/timeout/navigation.

### Security baseline
- Vault KV v2 + policy-per-path
- No secrets in logs
- Tamper-evident audit entries
- Rotation metadata displayed (last rotated, next due)

## 7) Trigger strategy (GitHub Actions + fallback)
Given client preference for remote operation:
- Primary: GitHub Actions run with 24h freshness guard.
- Fallback: dashboard-triggered local run when remote pipeline unavailable (budget cap or outage).
- Both runners write same normalized output and same audit log schema.

## Recommended Target Design (condensed)
1. **Data contract first**: freeze `fleet-resource.schema.json`.
2. **Prompt-builder versioning**: `prompt-template@vN` + tests.
3. **Two-phase validators**: schema + semantic.
4. **Consensus rule**: 2-of-3 agreement for non-trivial field updates.
5. **Deterministic policy gate** before writes.
6. **Automated commit with risk-class routing**.
7. **Locked-by-default credential editing** with Vault backend.
8. **Unified audit ledger** for updater + user edits.

## Actionable Next Steps
1. Create `fleet-resource.schema.json` and validator test fixtures.
2. Implement prompt-builder with deterministic sections (watchlist, prior snapshot hash, required sources).
3. Implement `research-runner` adapters (Groq/OpenRouter/Cerebras first).
4. Add resubmission loop with bounded retries and backoff.
5. Implement semantic validator module.
6. Implement policy gate and risk classifier.
7. Implement dashboard lock/unlock + resource-type edit modal.
8. Integrate Vault KV v2 storage adapter and audit writes.

## Final Recommendation
Proceed with the client’s multi-LLM architecture, but ship in **phases** with deterministic guardrails first. Keep automated commits, but gate high-risk changes through PR approval. Use locked-by-default credential editing with Vault as the default store and enforce short-lived unlock sessions.

This yields high governance confidence, lower operational risk, and preserves your goal of continuously updated fleet resource intelligence.
