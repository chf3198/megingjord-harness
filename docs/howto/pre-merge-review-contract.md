# Pre-Merge Review Contract — Schema + Semantics (#1741)

Formal contract for Epic #1736. Names the new baton artifact, defines required
fields, specifies sub-agent output format. Consumes Phase 1 research outputs
(#1737 architecture, #1738 triggers, #1739 format, #1740 #1716 integration).

## Artifact name

**`REVIEWER_FINDINGS`** (per #1740 recommendation; no regex collision with the
existing 5 artifact types).

## Position in the baton

```
Manager → Collaborator → REVIEWER_FINDINGS → Admin → Consultant
```

The artifact is emitted by a different-family agent than the Collaborator
(enforced via the new Rule 4 from #1740, mirroring Rule 2 admin diversity).

## Required fields (per #1718 baton schema)

```
REVIEWER_FINDINGS
ticket: #<N>
status: pending|advisory|blocking
verification-timestamp: <ISO8601>
Findings-Source: pre-merge-review-orchestrator v1
Findings-Count: <integer>
Severity-Distribution:
  high: <count>
  medium: <count>
  low: <count>
Auto-Escalate-Triggered: yes|no | <comma-separated trigger names if yes>
Findings: <inline SARIF or pointer to artifact path>

Signed-by: <human-alias>
Team&Model: <team:model@substrate>
Role: reviewer
```

## Findings JSON schema (per #1739 format decision)

Sub-agents emit findings as SARIF 2.1.0 (primary) + JSON Lines (secondary for
harness telemetry). Per-finding fields:

```typescript
interface Finding {
  severity: 'low' | 'medium' | 'high';
  category: 'bug' | 'security' | 'quality' | 'test-coverage' | 'architectural-drift';
  file: string;
  line: number;
  message: string;
  suggestion?: string;
  confidence: number;     // 0.0-1.0
  sub_agent: 'bug-detect' | 'security' | 'test-coverage' | 'architectural-drift';
  trigger?: string;       // auto-escalate trigger name if applied
}
```

SARIF wrapper structure documented in #1739; this contract defers to the
SARIF 2.1.0 spec for top-level shape.

## Sub-agent fan-out (per #1737 architecture decision)

4 parallel specialized sub-agents:

| Sub-agent | Domain | Detection focus |
|---|---|---|
| `bug-detect` | Logic correctness | Null deref, off-by-one, race conditions, error-handling gaps |
| `security` | Sec posture | Hardcoded secrets, injection vectors, auth bypass, crypto misuse |
| `test-coverage` | Test surface | New code lacking tests, removed tests, weak assertions |
| `architectural-drift` | Design integrity | Layer violation, dependency cycle, API contract drift |

Each sub-agent receives the diff + 20KB surrounding context + the auto-escalate
trigger matrix (#1738). Each emits its own findings; aggregator merges per the
severity-gate semantics (#1742).

## Integration with `extractRecordsFromComments` (per #1740)

Existing function in `scripts/global/baton-team-model-v2.js` extends with one
new branch:

```js
else if (body.includes('REVIEWER_FINDINGS')) {
  out.reviewer = tm;  // new roles_observed field
}
```

Estimated extension: ~5 lines helper + new field in the records dict.

## Rotation rule (per #1740 Rule 4)

```js
function checkRule4(records) {
  if (!records.reviewer) return null;
  const rt = extractTeam(records.reviewer);
  const prior = [records.manager, records.collaborator].map(extractTeam).filter(Boolean);
  return rt && prior.includes(rt)
    ? { rule: 'rule_4_reviewer_cross_family', detail: `reviewer team '${rt}' appears in earlier role` }
    : null;
}
```

Mirrors `checkRule2` shape; no new architecture.

## Validator-input format (consumed by #1742, #1743, Phase 3)

```json
{
  "ticket_number": 1234,
  "roles_observed": {
    "manager":   { "team": "claude-code" },
    "collaborator": { "team": "claude-code" },
    "reviewer":  { "team": "codex" },
    "admin":     { "team": "copilot" },
    "consultant": { "team": "openclaw" }
  },
  "operator_mode": "strict-rotation"
}
```

## Backward compatibility

- The existing #1716 contract (v2 rotation) continues to enforce Rules 1, 2, 3.
- Rule 4 adds to the v2 helper; no existing rule changes.
- Tickets without `REVIEWER_FINDINGS` artifact get Rule 4 skipped (validator
  returns `null` per the `if (!records.reviewer)` guard).
- Phase 4 (#1756) soak window is the only place where Rule 4 is required;
  advisory-only during the soak.

## Out of scope

- Implementing the validator extension — Phase 3.1 (#1752).
- Sub-agent prompt authoring — Phase 3.3 (#1754).
- Workflow YAML — Phase 3.2 (#1753).

## Related

- Epic #1736
- Phase 1 inputs: #1737 #1738 #1739 #1740
- Phase 2 siblings: #1742 (severity gates), #1743 (trigger matrix spec), #1744 (HAMR integration)
- Phase 3 consumers: #1752, #1753, #1754, #1755
