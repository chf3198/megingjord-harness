# Epic #1912 Orchestrator Governance Parity — v2 (cross-model iterated)

**Iteration history**: v1 (Codex Team, 2026-05-19) → v2 (claude-code Team multi-model
synthesis, 2026-05-19). Cross-family critique inputs: qwen2.5-coder:32b (Alibaba) ×3
angles, granite-code:3b (IBM), starcoder2:3b (BigCode). HAMR-wrapped fleet calls via
`scripts/global/multi-model-critique.js` (new helper this iteration).

## §0 Multi-model iteration summary

| Iteration | Reviewer | Family | Output | Signal |
|---|---|---|---|---|
| 1.a (general) | qwen2.5-coder:32b | Alibaba | structured critique | Permissions mapping incomplete; tests underspecified |
| 1.b (general) | granite-code:3b | IBM | partial structured | "lack of native agent gating, incomplete parity test coverage" |
| 1.c (general) | starcoder2:3b | BigCode | empty | small model couldn't follow structured-output instruction |
| 2 (security) | qwen2.5-coder:32b | Alibaba | structured critique | Permission escalation, hook bypass, deploy/sync ownership, cross-team concurrency attacks |
| 3 (operational) | qwen2.5-coder:32b | Alibaba | structured critique | wiki_docs_memory unanalyzed, state store parity not addressed, rollback atomicity missing |

**Convergence**: 2 of 3 families (Alibaba via qwen2.5-coder:32b + IBM via granite-code:3b)
identified parity-test underspecification + permissions mapping gaps. BigCode
(starcoder2:3b at 3B params) couldn't produce structured critique — fleet
capability gap noted (see §6).

## §1 Original v1 evidence matrix (preserved)

| Surface | Claude Code | Copilot | Codex | v1 rating | v2 reassessment |
|---|---|---|---|---|---|
| Instructions | `CLAUDE.md` | `.github/copilot-instructions.md` | `.codex/AGENTS.md` | good | good ✓ |
| Hooks/gates | no `hooks` in repo settings | 7 events wired | 5 events wired | weak | weak — but Claude Code hooks via settings.json IS supported per Anthropic docs; #1917 closes |
| Prompt gates | skill route only | includes `goal_lens.py` | missing `goal_lens.py` | weak | weak — #1919 closes |
| Permission gates | native possible | no native event | `PermissionRequest` unmapped | weak | **weak; deeper than v1 captured** — see §2 |
| Deploy/sync | `.claude/` only | broad asset deploy | codex runtime deploy | weak | weak — #1918 closes deploy semantics but NOT atomicity (see §3) |
| Skills/commands | missing command adapters | skills deployed | agent skills available | partial | partial — #1920 closes adapter gap; migration mechanism not specified |
| Parity tests | not covered | partial | partial | weak | weak — #1921 promotes existing test to CI but **doesn't expand coverage** (see §4) |

## §2 Gaps surfaced by multi-model iteration (NEW)

### G1 — Permissions mapping incomplete (cross-runtime privilege deltas)

**Source**: qwen-32b general + security angles, granite-3b general.

Codex's native `PermissionRequest` event is unmapped in the repo's adapter. If
mapped on Copilot but not Codex (or vice versa), an operator gets different
authorization-profile enforcement across runtimes. Per Epic #1758
(authorization profiles), this should produce equivalent owner/guarded/restricted
outcomes across all three. Currently it does not.

**Closing child**: #1919 partially addresses (Codex parity gates). Recommend
**extending #1919 scope** to include explicit `PermissionRequest` → authorization-
profile mapping evidence.

### G2 — wiki_docs_memory surface not analyzed

**Source**: qwen-32b operational angle. The canonical-surfaces list in
`inventory/orchestrator-governance-parity.json` includes `wiki_docs_memory`
but the v1 evidence matrix doesn't cover it. Wiki is read-only across runtimes
per `instructions/wiki-knowledge.instructions.md` — but READ paths and update
contracts differ.

**Recommendation**: file **NEW child** for wiki_docs_memory parity audit
(read-path + ingestion contract + log canon).

### G3 — State store parity (lease/lock/audit-log)

**Source**: qwen-32b operational angle. Each runtime stores governance state
in different homes:
- Claude Code: `~/.claude/`
- Copilot: `~/.copilot/`  
- Codex: `~/.codex/`
- Cross-cutting: `~/.megingjord/` (lease, incidents.jsonl, audit logs)

The audit `inventory/orchestrator-governance-parity.json` mentions state_store
as canonical surface but doesn't map per-runtime semantics. Lease state in
particular has different cleanup behaviors per runtime; lock files use
different schemes (PID+heartbeat in `cross-team-lease.js`, file-level locking
elsewhere).

**Recommendation**: file **NEW child** for state-store parity (lease + lock +
audit-log path normalization with per-runtime adapter spec).

### G4 — Rollback atomicity not designed

**Source**: qwen-32b operational angle. A parity change that breaks one
runtime (e.g. a Codex hook change that doesn't propagate to Claude Code)
has no rollback mechanism beyond `git revert`. Partial-deploy failures
(e.g. `npm run deploy:both` succeeds for Copilot but fails for Codex)
leave state inconsistent across runtimes.

**Recommendation**: file **NEW child** for deploy atomicity — either
all-three-or-none semantics, or explicit per-runtime rollback markers
with `~/.megingjord/deploy-audit.jsonl`.

### G5 — Cross-team concurrency state-injection attack vectors

**Source**: qwen-32b security angle. Epic #1854/#1855/#1827/#1876 cover
write-time + rebase-time + session-end + role-baton conflict prevention.
But a CROSS-RUNTIME injection (team A's PR injects state team B's gate
doesn't see) is a parity-attack surface not yet covered.

**Recommendation**: file **NEW child** for cross-runtime state-injection
attack-vector audit — extend existing conflict-prevention chain with
runtime-cross checks.

### G6 — Parity test coverage expansion (beyond CI promotion)

**Source**: qwen-32b general + granite-3b. #1921 promotes
`governance:orchestrator-parity` to strict CI but doesn't EXPAND the test
matrix to cover wiki, state-store, atomicity, or cross-runtime injection.

**Recommendation**: **extend #1921 scope** to require test coverage of
all canonical surfaces (currently inspects hooks + commands + skills; needs
state_store + wiki_docs_memory + deploy_atomicity).

## §3 Revised "must-fix" development children (5 new + 1 scope-extension)

Existing children from v1 retained:

| # | v1 scope | v2 scope adjustment |
|---|---|---|
| #1917 | Claude Code hook adapter | unchanged ✓ |
| #1918 | Deploy/sync `all` semantics | unchanged ✓ |
| #1919 | Codex `goal_lens` + `PermissionRequest` | **extend**: add explicit auth-profile mapping evidence per #1758 |
| #1920 | Claude command adapters | unchanged ✓ |
| #1921 | Promote parity audit to CI | **extend**: expand audit to cover state_store + wiki_docs_memory + deploy_atomicity |

New children to file (Phase-2):

- **#NEW-A**: wiki_docs_memory parity audit (read-path + ingestion contract + log canon across runtimes)
- **#NEW-B**: State-store parity (lease + lock + audit-log path normalization)
- **#NEW-C**: Deploy atomicity (all-three-or-none semantics OR rollback markers)
- **#NEW-D**: Cross-runtime state-injection attack-vector audit

## §4 Stress-test coverage requirement

Per Epic #1875 surface-applicability matrix: each new child above is a
side-effect-bearing governance gate OR adversarial-input parser. All four
NEW children REQUIRE `tdd-pyramid+stress-test` as composite test strategy.

## §5 Iteration verification (round 3, qwen2.5-coder:32b verification)

v2 was sent back through qwen-32b with a verification prompt focused on
each of the 6 gap classes. Result:

| Gap | Status | Reasoning |
|---|---|---|
| G1 Permissions | PARTIAL | "extended scope needed for explicit PermissionRequest → authorization-profile mapping evidence" |
| G2 Wiki_docs | OPEN | "wiki_docs_memory parity audit not addressed in this version" |
| G3 State store | OPEN | "state-store parity (lease + lock + audit-log path normalization) not addressed" |
| G4 Rollback | OPEN | "rollback atomicity not designed and no explicit per-runtime rollback markers" |
| G5 Cross-runtime injection | OPEN | "cross-runtime state-injection attack vectors not covered" |
| G6 Test coverage | PARTIAL | "promoted to CI, but does not expand coverage to all canonical surfaces yet" |

**OVERALL** (qwen-32b verdict): *"v2 addresses some gaps but leaves several
unaddressed, requiring further work on new children and scope extensions."*

**Interpretation**: this is the CORRECT verdict for the research/planning
deliverable. v2's job is to identify gaps and route them to children, NOT
to close them in the research note itself. The OPEN ratings confirm v2's
recommendations (file 4 new children + extend 2 existing scopes) are the
right path forward. Closing those gaps is implementation work for the
filed-and-extended children.

## §6 Fleet capability gap (operational note)

Only qwen2.5-coder:32b produced reliable structured critique. The 3B-param
models (granite-code:3b, starcoder2:3b) returned partial or empty responses
to structured-output prompts. This is a **fleet capability gap**: the
harness's cross-family review pattern (per Epic #1612 second-opinion-runner)
depends on having ≥2 high-capability models from distinct families. Currently
only ONE family (Alibaba) has a 32B-class model on the fleet.

**Recommendation**: file follow-on ticket to investigate fetching an additional
distinct-family large model onto the fleet (e.g. Llama 3.3 70B, DeepSeek-Coder
33B, or similar). Tracked separately.

## §7 Sources

- v1 research note: `research/epic-1912-orchestrator-governance-parity-2026-05-19.md`
- Multi-model critique tooling: `scripts/global/multi-model-critique.js` (new this iteration)
- Memory note: `feedback-cross-family-review-model-choice` (qwen2.5-coder:32b on 36gbwinresource)
- Epic #1612 cross-family second-opinion model
- Epic #1758 authorization profiles (context for G1)
- Epic #1854 / #1855 / #1827 / #1876 cross-team conflict prevention chain (context for G5)

## §8 Recommendation

v2 supersedes v1 for the Epic #1912 closure. Existing children #1917-#1921
are valid; two need scope extension (#1919 auth-profile mapping, #1921
coverage expansion). Four new children should be filed (NEW-A through
NEW-D) before Epic #1912 closes.

Signed-by: Orla Harper
Team&Model: claude-code:opus@local
Role: collaborator-analyst
