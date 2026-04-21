# Raptor Mini Design Analysis — Fleet Resource Table Autoupdate + User Editing

## Purpose
Document the research, actions, and critical analysis used to evaluate the proposed Fleet Resource Table autoupdate and user-editing design. This file records the temporary design analysis for the current assistant model, `raptor-mini`.

## Actions performed
- Searched the local repo for Karpathy / LLM Wiki pattern references and existing governance docs.
- Read the local Karpathy LLM Wiki source (`raw/articles/karpathy-llm-wiki-pattern.md`) and ADR (`research/adr/007-llm-wiki-adoption.md`).
- Gathered external context from Karpathy's published gist and JSON Schema docs via web fetch.
- Reviewed current repo structure and existing wiki-related dashboard files through search hits.
- Compiled a critical recommendation for the Fleet Resource Table autoupdate and secure edit workflow.

## Local sources referenced
- `raw/articles/karpathy-llm-wiki-pattern.md` — core Karpathy LLM Wiki pattern; emphasizes persistent compiled wiki, index/log structure, and schema governance.
- `research/adr/007-llm-wiki-adoption.md` — repo-specific decision to adopt Karpathy pattern, use raw/wiki/schema layers, and prefer OpenClaw local inference with failover.
- `wiki/sources/karpathy-llm-wiki-pattern.md` and `wiki/concepts/wiki-pattern.md` — existing markdown wiki copies of the pattern.
- Repo search results for `wiki-panel.js`, `wiki-metrics.js`, and `help-dev.js` show existing dashboard areas tied to wiki health and HELP documentation.

## External research references
- Karpathy LLM Wiki gist (`gist.github.com/karpathy/442a6bf555914893e9891c11519de94f`) — confirms the core pattern, the three-layer architecture, and the emphasis on compile-time knowledge maintenance rather than query-time RAG.
- JSON Schema docs (`json-schema.org/understanding-json-schema/`) — confirms that strict JSON validation is the right practice for LLM-generated structured output and that schema composition, type validation, and strict object structure are industry standard.
- Prompting guide sites (`learnprompting.org`, `promptingguide.ai`) — confirm that current best practices emphasize systematic prompt construction, self-consistency, and tool-assisted JSON generation for reliability.

## Critical analysis of the proposed design

### Strengths
1. **Use of Karpathy pattern** is aligned with existing repo governance. The design correctly treats the resource table as a compiled knowledge artifact, not just a live RAG result.
2. **Multi-LLM validation plus JSON schema** is strong: it uses redundancy, enforces structure, and provides a way to resubmit bad outputs rather than accept them blindly.
3. **Vault-backed secrets + lock/unlock UI** is the right security posture for credentialed fleet resources.
4. **Dashboard fallback for autoupdate** is smart: it preserves functionality when GitHub-hosted workflows are blocked by spending limits.

### Risks and weaknesses
1. **LLM Wiki collapse risk**: Karpathy-style wikis are powerful at small scale but can drift if the ingest process is not tightly audited. This design must preserve source truth and keep the compiled table clearly derived from raw provider docs.
2. **Auto-commit policy tension**: fully automatic commits of generated inventory data are efficient, but structural changes or schema evolution should still be gated to avoid silent model-induced corruption.
3. **Performance / cost tradeoff**: multi-LLM consensus adds robustness, but it also adds latency and API cost. The design should prioritize external free models first and use Copilot only when needed for higher-confidence review.
4. **Dashboard complexity**: lock/unlock + per-resource modals are correct, but they increase UI complexity. The table should remain lightweight and not require users to manage too many nested states.
5. **HELP governance dependency**: the design assumes HELP docs will be kept in sync, but without explicit CI rules this can degrade quickly. The repository needs a concrete policy, not just an Epic.

## Recommendation

### Recommended final design
1. **Table format**: maintain a compact table row for each fleet resource with these core columns:
   - `ID`, `Name`, `Type`, `Status`, `Models/Capabilities`, `Cost`, `Credential required`, `Last checked`, `Edit`
   - Use hover tooltips or row expansion for extended metadata such as source URLs, validation status, and baton-resource mapping.
2. **Autoupdate pipeline**:
   - A GitHub Action is the primary updater, triggered by repo activity and guarded by a `lastUpdate` timestamp to skip if <24h.
   - A dashboard fallback trigger exists for local recovery when remote execution is blocked.
   - The pipeline should use a **prompt-builder module** that generates versioned prompts and includes the current resource table snapshot, watchlist, and JSON schema.
   - Use **strict JSON Schema validation** for all LLM outputs. If validation fails, resubmit with schema errors and original candidate output, up to 3 retries.
   - Aggregate multiple researcher outputs with a **2/3 consensus** threshold; if entries disagree, flag them for review instead of auto-committing.
   - Reserve Copilot GPT-5 mini as an optional secondary reviewer, not as the default external researcher.
3. **Edit flow**:
   - Default the table to locked on render. Unlocking requires a validated session token or admin action, then remains unlocked for a short timeout.
   - `Edit` opens a per-resource modal that shows only the credential fields relevant to that resource type.
   - Perform server-side validation of any submitted secret before Vault persistence.
   - Persist secrets in HashiCorp Vault; if Vault is unavailable, use an encrypted local fallback, but clearly warn the user.
4. **Governance / HELP**:
   - Add a CI check or PR job that detects changes to `inventory/` or dashboard flows and requires a linked HELP/doc-update ticket.
   - Treat `help-dev` and `help-user` coverage as part of PR acceptance criteria for any feature affecting Fleet Resources or credentials UI.
   - Use the existing Karpathy Wiki log/index pattern to record the autoupdate pipeline’s raw sources and decisions.

### Implementation parameters
- **Consensus threshold**: 2/3 (acceptable for daily autoupdate with multiple free models).
- **Retry policy**: 3 validation/resubmission attempts.
- **Commit policy**: auto-commit non-structural updates; open PR for structural/schema changes or when source disagreement >40%.
- **Primary researchers**: Groq, OpenRouter, Cerebras; secondary reviewer: GPT-5 mini / Copilot if available.
- **Source traceability**: store raw provider page metadata and LLM responses in `raw/ai-matrix/` and `logs/ai-matrix/`.

### Strongest changes from the original proposal
- Add a **hybrid auto-commit policy** rather than blind auto-commit.
- Add explicit **source-traceability rules** for compiled table updates.
- Favor **external free model researchers first** and reserve paid Copilot only for review or fallback.
- Tie HELP updates to concrete CI governance, not just an Epic.

## Recommended next step
Implement a minimal prototype of the autoupdate pipeline and table schema first, then test with a real GitHub Action fallback trigger. Keep the initial UI modal simple and lock/unlock behavior explicit, then extend the experience once the core secure-edit flow is validated.

## Notes on current repo fit
- The repo already has the Karpathy pattern and an ADR backing it.
- Existing dashboard wiki metrics and help modules show this repo can support the governance layer.
- The requested design is feasible, but it must be executed with structured audit logs and conservative commit rules.

---

Generated by `raptor-mini`.
