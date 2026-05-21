# Deliverable 3 — Canonical programmatic-build pattern design

Phase-0 ticket: #2038. Parent Epic: #2037.

## The pattern

```
                     ┌─────────────────────────────┐
                     │ Structured input (JSON)     │
                     │ — per-ticket data           │
                     │ — schema-validated          │
                     └──────────┬──────────────────┘
                                │
                                ▼
                ┌──────────────────────────────────┐
                │ Template engine (Mustache or EJS)│
                │ — deterministic                  │
                │ — bytes-identical across runtimes│
                └──────────┬───────────────────────┘
                           │
                           ▼
             ┌──────────────────────────────────┐
             │ Validated artifact (Markdown)    │
             │ — passes all megalint validators │
             │ — posted as baton comment        │
             └──────────────────────────────────┘
```

LLM intervention surface = **the structured-input JSON**, not the rendered artifact. The model fills typed fields; the template assembles the canonical comment.

## CLI contract

Extend the existing `scripts/global/baton-comment-build.js` (which already supports minimal stub generation) to a full templated builder:

```bash
node scripts/global/baton-comment-build.js \
  --artifact MANAGER_HANDOFF \
  --ticket 1234 \
  --team-model claude-code:opus-4-7@local \
  --role manager \
  --lane lane:code-change \
  --test-strategy tdd-pyramid \
  --scope "<short scope text>" \
  --acceptance-json /path/to/acs.json \
  --gates-json /path/to/gates.json \
  --phase-gate-satisfied yes \
  --phase-0-sources "1963,1964" \
  --anneal-tier null \
  --anneal-tickets-filed "none — Refs #1234" \
  > /tmp/manager-handoff-1234.md

# Comment posting still a separate call so the operator can review
gh issue comment 1234 --body-file /tmp/manager-handoff-1234.md
```

Same signature works across all three runtimes; output bytes-identical for identical input.

## Structured-input schema (JSON Schema)

Per artifact type, a JSON Schema gates the input:

### MANAGER_HANDOFF schema (Draft 2020-12)

```jsonc
{
  "type": "object",
  "required": ["ticket", "team_model", "role", "scope", "lane", "test_strategy", "gates", "acceptance"],
  "properties": {
    "ticket":           { "type": "integer", "minimum": 1 },
    "team_model":       { "type": "string", "pattern": "^[a-z\\-]+:[a-z0-9\\-.]+@[a-z\\-]+(/.+)?$" },
    "role":             { "type": "string", "enum": ["manager"] },
    "lane":             { "type": "string", "enum": ["lane:code-change", "lane:docs-research", "lane:docs-only", "lane:trivial", "lane:research", "lane:config-only"] },
    "test_strategy":    { "type": "string", "enum": ["tdd-pyramid", "tdd-trophy", "contract-test", "golden-file", "eval-harness", "visual-regression", "drift-lint", "peer-review", "manual-verify", "stress-test", "none"] },
    "scope":            { "type": "string", "minLength": 30, "maxLength": 2000 },
    "gates":            { "type": "array", "items": { "type": "string" }, "minItems": 1 },
    "acceptance":       { "type": "array", "items": { "type": "object", "required": ["id", "status"], "properties": { "id": { "type": "string" }, "status": { "type": "string", "enum": ["PASS", "FAIL", "DEFERRED", "N/A"] }, "rationale": { "type": "string" } } } },
    "anneal_tier":      { "type": ["string", "null"], "enum": [null, "tier-1", "tier-2", "tier-3"] },
    "phase_gate_satisfied": { "type": "string", "enum": ["yes", "n/a"] },
    "phase_0_sources":  { "type": "array", "items": { "type": "integer" } },
    "anneal_tickets_filed": { "type": "string" }
  }
}
```

Equivalent schemas for COLLABORATOR_HANDOFF, ADMIN_HANDOFF, CONSULTANT_CLOSEOUT, CONSULTANT_EPIC_CLOSEOUT, BLOCKER_NOTE, EPIC_RESCOPE, EPIC_AMENDMENT.

### Template engine choice

**Mustache** is the recommended engine. Rationale:

- Logic-less template language → no template-side branching that could differ across runtimes
- Available in Node + Python + Bash (consistent across all 3 runtime languages)
- Used by GitHub for issue templates; familiar to operators
- Bytes-identical output guarantee is easy to verify

Alternative: **EJS** if Node-only is fine. EJS allows light JS expressions which can sneak in non-determinism — Mustache's no-logic approach is safer.

## Bytes-identical invariant — how to verify

Replay-eval test: feed the same JSON to the builder on 3 runtimes (CC, Copilot, Codex); SHA-256 the output; assert all 3 hashes match. If any drift, the build is rejected.

```bash
# Per-runtime spawn
for rt in claude-code copilot codex; do
  RUNTIME=$rt node scripts/global/baton-comment-build.js --artifact MANAGER_HANDOFF --input /tmp/sample.json > /tmp/output-$rt.md
done
# Assert
sha256sum /tmp/output-*.md | awk '{print $1}' | sort -u | wc -l   # MUST output 1
```

This is the Phase-1 acceptance gate: identical input across runtimes must produce identical bytes.

## Minimum LLM-intervention surface (where LLM still authors)

LLM fills structured-input JSON slots; specifically:

1. **`scope` field** — LLM-authored prose (with maxLength: 2000 enforcing brevity)
2. **`acceptance[].rationale`** — per-AC narrative (LLM judgment)
3. **`gates[]`** — LLM enumerates the relevant gates from the scope context
4. **In CONSULTANT_CLOSEOUT**: `verdict_rationale`, `mid_flight_flaws[].decision_rationale`

All other fields are derivable / typed / constrained. The template renders the canonical Markdown around them.

## Migration path

Phase-1 children sequence:

1. **Schema definition** — author JSON Schema files under `inventory/baton-schemas/` for all 8+ artifact types
2. **Mustache templates** — author `.mustache` templates under `inventory/baton-templates/` matching each schema
3. **Build CLI** — extend `scripts/global/baton-comment-build.js` to render template from schema-validated input
4. **Validator integration** — closeout-schema.yml validator already exists; ensure builder output passes 100% on a corpus of historical baton artifacts
5. **Cross-runtime parity test** — `tests/baton-bytes-identical.spec.js` invokes the builder on the same input via 3 runtime contexts; asserts SHA equality
6. **Replay-eval** — `tests/baton-replay-eval.spec.js` runs the builder against 50+ historical baton artifacts from `gh issue view N --json comments`; asserts output matches the historical canonical (within minor whitespace/timestamp variance)
7. **Operator-side adapter** — `scripts/global/baton-build-from-context.js` LLM-bridge that gathers context, calls model with a JSON-output-only system prompt, validates against schema, hands JSON to the builder
8. **Deprecation of manual artifact composition** — instructions update; megalint validator promoted from advisory to required for any new artifact comment

## Inter-artifact uniqueness

The signer-alias fidelity rules + cross-artifact prose collision rules become **trivially satisfied** because the template controls all output. The model can't accidentally mention another artifact's signer in prose because it never writes the prose — it writes structured `signer` field; template assembles.

## Backward compatibility

Existing baton artifacts remain valid. The builder is opt-in initially. Phase-1 introduces a label-driven enforcement: tickets labeled `programmatic-baton-required` MUST use the builder; others may use LLM-generation. Promotion to repo-wide required happens via replay-eval calibration on the historical corpus.

## Open design questions for Phase-1 to resolve

1. **Where do schemas live?** `inventory/baton-schemas/` is the recommendation; aligns with `inventory/rubric-g1-g10-v3.json` pattern
2. **Template engine deps** — Mustache via `mustache` npm package OR pure-JS micro-implementation to avoid dep weight (Mustache is ~30 lines of code)
3. **LLM-context-to-JSON bridge** — implementation choice: PydanticAI (Python-side hooks) vs `@anthropic-ai/sdk` structured outputs (Node-side wrapper) vs raw JSON-mode prompting. Recommendation: native structured outputs per Anthropic 2026 (`response_format: { type: "json_schema", json_schema: ... }`) — eliminates parse failures.
4. **Operator review surface** — the build CLI outputs to a file by default, NOT direct comment-post. Operator reviews before posting. (Matches current pattern.)

## References

- Existing builder: `scripts/global/baton-comment-build.js`
- Existing rubric: `inventory/rubric-g1-g10-v3.json` + `scripts/global/rubric-score.js`
- Existing signer registry: `inventory/team-model-signatures.json` + `scripts/global/agent-signature.js`
- 2026 patterns cited in Deliverable 2
