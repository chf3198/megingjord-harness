# HAMR Cross-Family Model Inventory (#1717)

Inventory of providers + model families actually available to the harness,
mapped against the Epic #1716 rotation rules. Sourced from
`scripts/global/routing-provider-adapters.json`,
`scripts/global/model-routing-policy.json`, and
`inventory/team-model-signatures.json`.

## Active HAMR-routed providers

| Provider | Lane(s) | Family | Default model |
|---|---|---|---|
| `anthropic` | haiku, premium | **anthropic** | claude-haiku-4-5, claude-sonnet, claude-opus |
| `openai-compatible` | free, haiku, premium | **openai** | gpt-5-mini, gpt-5, gpt-5-codex |
| `openrouter` | free, haiku, premium | **aggregator** (multi-family) | varies |
| `litellm` | free, haiku, premium | **aggregator** (multi-family) | varies |
| `ollama` | fleet | **mixed** (local) | qwen2.5:7b-instruct, gemma3:1b/270m |
| `fleet` | fleet | **mixed** (local) | heavy-coding, coding adapters |

## Family taxonomy per Epic #1716 contract spec

"Family" is defined by the `team` field of `Team&Model` (per Child #1719 AC2). Applied to the HAMR-routed providers:

| `team` field | Concrete family | Provider(s) |
|---|---|---|
| `claude-code` | anthropic | anthropic, openrouter (claude), litellm (claude) |
| `copilot` | mixed-anthropic (Copilot wrapper) | anthropic via Copilot subscription |
| `codex` | openai | openai-compatible (gpt-5 variants) |
| `openclaw` | mixed-local | ollama (qwen/mistral/phi), fleet adapters |

## Baton-transition viability matrix

Assume an operator has all 4 families available (multi-family fleet). The 3 rotation rules can be satisfied as follows:

| Transition | Cross-family choice |
|---|---|
| Manager → Collaborator | claude-code (anthropic) → codex (openai) |
| Collaborator → self-check | codex (openai) → openclaw (local-qwen) |
| Collaborator → Admin | codex (openai) → copilot (anthropic-via-wrapper; functionally distinct routing path) OR openclaw (local) |
| Admin → Consultant | copilot (anthropic) → openclaw (local) OR any unused family |

**4 distinct families used**: anthropic, openai, copilot (wrapper-anthropic but distinct routing), openclaw. **Sufficient** to satisfy all 3 rules on multi-family fleet.

## Operator profiles that cannot satisfy strict-rotation

| Profile | Available families | Can satisfy? | Recommendation |
|---|---|---|---|
| **anthropic-only** (subscription operator) | 1 (anthropic) | ❌ NO | `single-model-fleet` declaration; rotation skipped |
| **openai-only** (subscription operator) | 1 (openai) | ❌ NO | `single-model-fleet` declaration |
| **ollama-only / air-gapped** (local fleet) | 1 (openclaw local) | ❌ NO | `single-model-fleet` declaration |
| **2-family operator** (e.g., anthropic + openai) | 2 | ⚠️ PARTIAL | `advisory-only` mode (Rule 3 unsatisfiable; Rules 1+2 satisfiable) |
| **3-family operator** (anthropic + openai + local) | 3 | ⚠️ PARTIAL | `advisory-only` for Rule 3 (Consultant); Rules 1+2 enforceable |
| **4+ family operator** | 4+ | ✅ YES | `strict-rotation` default |

## Recommendation to Phase 2.4 (G5 fallback spec, #1722)

The 3 operator modes from the Epic body map cleanly onto family count:

- **strict-rotation**: 4+ families available (Rule 3 satisfiable)
- **advisory-only**: 2-3 families (Rules 1, 2 enforceable; Rule 3 advisory)
- **single-model-fleet**: 1 family (rotation skipped; operator accepts bias risk)

Auto-detection logic for Phase 2.4 / Phase 3.3 implementation:

```javascript
function detectRotationMode(availableFamilies) {
  if (availableFamilies.length >= 4) return 'strict-rotation';
  if (availableFamilies.length >= 2) return 'advisory-only';
  return 'single-model-fleet';
}
```

Where `availableFamilies` is derived from the lane→adapter→family mapping
at `npm run hamr:activate` time.

## Concrete gap: single-family operators dominate

In practice, most operators today use ONE subscription (Anthropic OR OpenAI), not both. This means **the default operator profile is `single-model-fleet` or `advisory-only`, NOT `strict-rotation`**. The rotation contract is most enforceable when:

1. The operator runs both anthropic AND openai keys, OR
2. The operator runs anthropic/openai + a local Ollama model (qwen2.5 or gemma3), OR
3. Cross-team baton flow (claude-code Manager + codex Collaborator + copilot Admin) is genuinely active.

Path (3) — cross-team baton — is the strongest enforcement vector AND aligns with the harness's existing multi-team architecture. Phase 3 implementation should optimize for cross-team baton flows; single-team baton is the degraded case.

## AC verification

- [x] AC1: All 4 active HAMR providers + families listed.
- [x] AC2: Baton-transition viability matrix delivered.
- [x] AC3: 6 operator profiles identified.
- [x] AC4: Recommendation to Phase 2.4 delivered.

## Sources

- `scripts/global/routing-provider-adapters.json` (v1.0.0)
- `scripts/global/model-routing-policy.json` (v2.2.0)
- `inventory/team-model-signatures.json` (lastUpdated 2026-05-12)
- `instructions/hamr-routing.instructions.md`

## Related

- #1716 (parent Epic)
- #1722 (Phase 2.4 G5 fallback spec — consumes this output)
- #1723 (Phase 3.1 helper extension — consumes the detection logic)
- #1572 (existing critical-path advisory)
- #1628 (G5 backing)
