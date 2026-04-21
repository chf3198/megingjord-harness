# Critical Analysis — Fleet Resource Table Design
**Model**: Claude Sonnet 4.6 | **Date**: 2026-04-20
**Ref**: GPT-5.3-Codex analysis (same folder), GH Epic #331

---

## Grounding Sources

| Source | Key Takeaway |
|--------|-------------|
| `wiki/syntheses/devenv-ops-enforcement-architecture.md` | Deterministic hooks = 99% confidence; advisory instructions = 65–70%. Policy gates must be deterministic, not LLM-based. |
| `wiki/sources/free-tier-inventory.md` | 8 free-tier services catalogued. Matrix updater must cross-reference this as baseline to avoid re-discovering known services. |
| OWASP Secrets Management Cheat Sheet | Vault KV v2 + least-privilege token per path; no plaintext in logs; audit retention 90+ days; break-glass backup mandatory; short unlock TTL (≤5 min). |
| HashiCorp Vault Docs | Integrated storage recommended; plugin auth (GitHub/LDAP); policy-per-path; KV v2 for versioning + metadata; full audit log out-of-box. |

---

## Prior Design Critique (GPT-5.3-Codex, same folder)

GPT's analysis is **architecturally sound** and correctly identifies:
- Core + expando table format to prevent horizontal scroll
- Two-phase validation (syntactic + semantic)
- Risk-classified auto-commit (low / medium / high)
- Reviewer LLM as advisory-only, deterministic gate as final authority
- Stage A (minimal viable) → Stage B (consensus tier) phased rollout

**Agreements**: All 8 recommendations are correct. No reversals required.

**Additions and sharper constraints** follow below.

---

## Critical Analysis — 8 Sections

### 1. Table Layout: Column Width Constraints

GPT recommends core + expando but does not specify widths.

**Gap**: Without explicit `max-width` constraints, Status and Access Method columns
expand and still cause overflow on 1366px screens (Chromebook native).

**Fix**: Enforce at the CSS level, not the data level:
```
Name: 180px | Status: 80px | Type: 80px | Access: 100px | Last Seen: 100px | Cred State: 100px
```
Total: 640px + expando toggle (40px) = 680px — safely within 1280px viewport.
Apply `overflow-x: hidden` on `.fleet-resources-section`, not the full dashboard.

### 2. Credential State: 3-State Enum Is Mandatory

GPT implies boolean (locked/unlocked). This is **insufficient**.

The missing state is `missing` — resource exists in inventory but no credential has been
provisioned yet. Without `missing`, the UI has no way to distinguish "locked (credential
exists)" from "never provisioned," and the edit modal would silently create duplicate entries.

**Required enum**: `locked | unlocked | missing`

UI treatment:
- `locked` → lock icon, "Edit" button (triggers unlock flow)
- `unlocked` → green unlock icon + TTL countdown, fields editable
- `missing` → warning icon, "Provision" button (opens Vault write flow, not edit)

### 3. Unlock TTL and Session Storage

OWASP §4.2: short-lived unlock window required. GPT defers to implementation.

**Constraint**: Unlock token (Vault lease) must be:
- ≤5 min TTL (hard cap, not user-configurable)
- Delivered via HttpOnly cookie or server-side session — **never localStorage**
- Revoked on page unload or section collapse (not just on timeout)

Dashboard is Alpine.js + static server. Implementation requires a thin server-side
session endpoint on `dashboard-server.js` to hold the Vault lease — not a pure
client-side flow.

### 4. Pipeline Data Contract: Schema First

The client's multi-LLM pipeline has a critical ordering dependency GPT does not flag explicitly:

**The `fleet-resource.schema.json` must be frozen BEFORE any LLM prompt is written.**

Correlated model failure (multiple LLMs share the same incorrect assumption about a
provider's API schema) is the highest-risk pipeline failure mode — not individual model
errors. If the schema is vague, all models will produce plausibly-different-but-wrong outputs
that pass syntactic validation.

**Required schema fields**:
```json
{ "name": "string", "type": "device|llm-api|service",
  "access_method": "string", "endpoint": "string|null",
  "credential_state": "locked|unlocked|missing",
  "last_seen": "ISO8601", "last_updated_by": "string",
  "auto_update_eligible": "boolean" }
```
Semantic validators must include: URL reachability check + model-ID normalization
against `inventory/ai-models.json`.

### 5. Policy Gate: Deterministic Over Advisory

Wiki enforcement architecture shows this repo already uses deterministic hooks
(99% confidence) as the authoritative enforcement layer, with advisory instructions
as supplementary (65–70%).

GPT correctly identifies the reviewer LLM as advisory-only. Adding explicit language:

**The policy gate is code, not LLM.** The gate must check:
1. Schema valid (JSON Schema validation, synchronous)
2. No credential fields in commit payload (regex scan, synchronous)
3. Structural change flag set correctly (diff line count threshold)
4. Source LLM responses ≥ consensus threshold (configurable, default: 2/3)

All 4 checks are deterministic. The reviewer LLM produces a natural-language summary
for the PR description — it does NOT produce a pass/fail signal.

### 6. Auto-Commit Audit Trail

OWASP §3.4: audit logs ≥90 days. GitHub Actions default retention: 90 days for logs,
configurable for artifacts.

**Required tagging protocol**:
- Commit message prefix: `auto: ai-matrix-updater — <provider> <date>`
- Git tag: `auto/ai-matrix-updater/YYYY-MM-DD`
- Structural changes: open PR with label `auto-generated`, `needs-review`
- PR body: include reviewer LLM advisory summary + validation evidence

Cross-reference `wiki/sources/free-tier-inventory.md` in commit body for traceability.

### 7. Activity Trigger: Guard Implementation

Client confirmed activity-trigger (not cron) + 24h guard. GPT defers implementation.

**Concrete guard**:
```js
// scripts/ai-matrix-updater.js
const GUARD_FILE = 'logs/ai-matrix-last-run.json';
const last = JSON.parse(fs.readFileSync(GUARD_FILE, 'utf8'));
if (Date.now() - last.ts < 86_400_000) process.exit(0); // skip
```
Guard file committed with each run. Fallback trigger: dashboard `/api/ai-matrix/trigger`
endpoint (already in `dashboard-server.js` server architecture).

### 8. Break-Glass Credentials

OWASP requires break-glass backup. Vault-primary environments need an offline fallback.

**Implementation**: Separate Vault path (`secret/break-glass/<resource>`) with stricter
access policy (requires 2-person approval or time-bound break-glass token).
UI should show a "Break-glass used" warning badge on the resource row post-access.
Break-glass events must trigger an immediate audit log entry + Slack/webhook alert.

---

## Recommended Target Design (Additions to GPT Analysis)

1. Freeze `fleet-resource.schema.json` before writing any LLM prompts
2. Enforce 3-state `credential_state` enum (`locked | unlocked | missing`)
3. Unlock flow: server-side session endpoint; 5-min TTL; revoke on page unload
4. Add explicit CSS column widths (680px total) + `overflow-x: hidden` on section
5. Policy gate: 4 deterministic checks; reviewer LLM = PR summary only
6. Auto-commits: tag `auto/ai-matrix-updater/YYYY-MM-DD`, reference wiki baseline
7. Guard file (`logs/ai-matrix-last-run.json`) committed with each run
8. Break-glass path in Vault; badge warning in UI; webhook alert on use

---

## Actionable Next Steps (Delta from GPT Analysis)

| Priority | Action | Owner |
|----------|--------|-------|
| P0 | Freeze `fleet-resource.schema.json` | Implementer |
| P0 | Add `missing` state to credential enum | Implementer |
| P1 | Server-side session endpoint for Vault lease | Implementer |
| P1 | CSS column width enforcement | Implementer |
| P1 | Policy gate implementation (4 checks) | Implementer |
| P2 | Guard file + activity trigger wiring | Implementer |
| P2 | Break-glass Vault path + UI badge | Implementer |
| P3 | Reviewer LLM PR summary template | Implementer |
