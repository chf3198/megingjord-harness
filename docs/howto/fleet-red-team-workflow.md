# Fleet Adversarial Red-Team Workflow

This runbook describes how to dispatch fleet-based adversarial red-team reviews against harness artifacts (epics, child tickets, baton handoffs, PR diffs, instruction edits). Operationalized by Epic #2041. Fleet-model-readable: short paragraphs, tables not nested prose.

## 1. Goal

Use a cross-family fleet model (qwen2.5-coder:32b on Tailscale fleet host) to red-team primary-model artifacts. Findings classified ACCEPT/REJECT/PARTIAL surface real defects the primary missed. All dispatches HAMR-routed (`tier='fleet-local'`) for cost tracking. Per Phase-0 #2174 design.

## 2. When to dispatch

| Trigger | Template type | Iteration target |
|---|---|---|
| Epic at status:triage | `epic-scope` | 1-2 |
| Child ticket scoping | `child-implementation` | 1-2 |
| Before posting the-collaborator-handoff | `collaborator-handoff` | 1 |
| Before merging PR | `admin-handoff` + `pr-diff` | 1-2 |
| At the-consultant-closeout review | `consultant-closeout` | 1 |
| Editing `instructions/**/*.md` | `instruction-edit` | 1 |

## 3. Template selection

Templates live in `config/fleet-red-team-prompts.json` (P1-3 #2181). Each template carries `prompt_template`, `iteration_target`, `findings_cap`, `focus_areas`, `expected_token_range`. Select by artifact type. The dispatcher (`scripts/global/fleet-red-team-dispatch.js` P1-1 #2175) loads templates and substitutes `{{content}}`.

## 4. Reading findings

Findings classified per Phase-0 AC-R4:

| Verdict | Meaning | Action |
|---|---|---|
| ACCEPT | Real defect verifiable on current code/process | File anneal ticket or fix in-PR |
| REJECT | Fleet hallucination OR already-handled | Document rationale in collaborator triage |
| PARTIAL | Real concern but not in scope OR cost-of-prevention > cost-of-detection | Note for future-revisit ticket |

The formatter (`scripts/global/baton-fleet-review-comment.js` P1-2 #2179) renders findings as a markdown table with canonical `Role: red-team-reviewer` signature.

## 5. Iteration loop

Cross-family red-team converges in 2-3 iterations when primary explicitly classifies every finding per row (memory `feedback-red-team-iteration-pattern`). Per Zenflow guidance, cap at 4-6 findings per iteration (`findings_cap` per template).

```
iter 1: dispatch → fleet returns 6 findings → primary triages → 2 ACCEPT
iter 2: dispatch with revised artifact → fleet returns 3 findings → primary triages → 0 ACCEPT
                                                                       ↓
                                                                  CONVERGED
```

Maximum 3 iterations per artifact per session. Beyond that, the prompt template likely needs revision (file a Phase-2 follow-on).

## 6. Cost monitoring

Each dispatch records to `~/.megingjord/cache-stats.jsonl` via HAMR with `tier='fleet-local'` and `provider='ollama'` (per #2178 P1-7). Query daily cost:

```bash
jq -s 'map(select(.tier=="fleet-local")) | length' ~/.megingjord/cache-stats.jsonl
```

Budget per Phase-0 AC-R6:
- <2K input + <1.5K output tokens per dispatch
- <45s p95 clock per call
- ≤3 dispatches per baton cycle (collab + admin + consultant)
- ≤21 dispatches per session

Ollama on Tailscale fleet host is `$0/call` — budget enforces fleet-host load not dollar cost.

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `wrapProviderCall` returns `ok:false, error:'aborted'` | 600s timeout fired; fleet host overloaded | Reduce `num_predict`; check fleet host load with `curl http://fleet/api/tags`; retry |
| `sticky:{provider:'groq', ...}` instead of ollama in cache-stats | Used tier='fleet' instead of 'fleet-local' | Always pass `{tier: 'fleet-local'}` per P1-7 #2178 |
| Empty findings + `warning:'fleet-refused'` | Fleet model alignment refusal | Re-dispatch with neutral framing; if recurring, revise template |
| Fleet response contains arxiv URLs that don't resolve | Hallucination | Already stripped by `stripArxivHallucinations`; ignore in findings |
| Concurrent dispatches contend on `incidents.jsonl` | append-write race | append-write is OS-atomic on POSIX; not a real issue. If observed, file follow-on. |
| Fleet host unreachable | Tailscale down / fleet machine off | Fall back to local gemma3:1b on Chromebook with warning marker |

## See also

- Epic #2041 + Phase-0 #2174 (research foundation)
- `instructions/hamr-routing.instructions.md` (HAMR contract)
- `wiki/wisdom/global/concepts/cache-adapters.md` (cost-tracking pattern)
- Memory `feedback-red-team-iteration-pattern` (cross-family convergence)
- Memory `feedback-cross-family-review-model-choice` (qwen2.5-coder:32b on fleet host)

Refs Epic #2041. Refs #2180.
