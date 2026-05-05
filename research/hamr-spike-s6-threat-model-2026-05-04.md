---
title: "HAMR Spike S6 — STRIDE Threat Model"
date: 2026-05-04
ticket: 881
epic: 860
status: research-deliverable
---

# HAMR Spike S6 — STRIDE Threat Model

## 1. Summary

Formal STRIDE threat model for HAMR v3, scoped to five adversary classes
(A1–A5). Analysis is grounded in `research/hamr-v3-2026-05-04.md` (cited as
`hamr-v3 §N`) and `research/hamr-spike-s1-code-audit-2026-05-04.md` (cited as
`S1 §N`).

### Residual Risk Summary

| Adversary | Description | S | T | R | I | D | E | MEDIUM+ |
|---|---|---|---|---|---|---|---|---|
| A1 | Compromised CF account | LOW | MEDIUM | LOW | LOW | LOW | MEDIUM | 2 |
| A2 | Leaked operator JWT | MEDIUM | LOW | LOW | LOW | LOW | LOW | 1 |
| A3 | Malicious fleet model | MEDIUM | MEDIUM | LOW | MEDIUM | LOW | HIGH | 4 |
| A4 | Supply-chain attack on bundle | LOW | MEDIUM | LOW | LOW | LOW | LOW | 1 |
| A5 | MCP client OAuth replay | MEDIUM | LOW | LOW | LOW | LOW | LOW | 1 |

Total MEDIUM or HIGH residuals after existing HAMR mitigations: **9 of 30
STRIDE cells.** Four required design changes are documented in §6. A3
(malicious fleet model) has the worst residual profile.

## 2. Methodology

### STRIDE definitions

| Category | Threat goal |
|---|---|
| **S** Spoofing | Impersonating a principal (user, system, or service) |
| **T** Tampering | Modifying data or code without authorization |
| **R** Repudiation | Denying that an action occurred; defeating audit trails |
| **I** Information Disclosure | Exposing data to unauthorized parties |
| **D** Denial of Service | Degrading or eliminating service availability |
| **E** Elevation of Privilege | Gaining capabilities beyond granted permissions |

### HAMR-specific scope

In scope: the HAMR Worker (Cloudflare), R2 mailbox, KV index, fleet Ollama
dispatch path (`cascade-dispatch.js`), MCP OAuth 2.1 + DPoP layer, SLSA/Cosign
bundle delivery, and operator-local state files
(`~/.megingjord/identity.json`, `substrate-health.json`).

Out of scope: Cloudflare's internal infrastructure security (trusted substrate),
GitHub Actions runner security (CI boundary), physical hardware attacks on fleet
devices, and social-engineering attacks on the human operator. Provider-side
security (Anthropic, OpenAI, Google, Groq) is also out of scope; HAMR consumes
their APIs but cannot control their internal security posture.

### Residual risk ratings

- **LOW**: Mitigated by existing HAMR design; residual requires multiple
  simultaneous failures to exploit.
- **MEDIUM**: Mitigated partially; a realistic single-step bypass exists or the
  mitigation depends on operator discipline.
- **HIGH**: Not adequately mitigated; exploitable with moderate effort.

## 3. Adversary Class Definitions

### A1 — Compromised Cloudflare Account

Attacker holds CF account credentials (API token, OAuth session, or dashboard
access) with at least Worker and R2 write permissions — for example via phishing
or a compromised long-lived CI token. HAMR v3 §1 eliminates long-lived CF API
tokens from CI via OIDC federated publishing; dashboard-level compromise
bypasses OIDC controls.

### A2 — Leaked Operator JWT

The operator's DPoP-bound JWT (`~/.megingjord/identity.json`) is exfiltrated
from the local filesystem by a compromised npm script, malicious VS Code
extension, or process with read access to the home directory. HAMR v3 §1
binds tokens to DPoP proof-of-possession (RFC 9449); a bare JWT without the
DPoP private key cannot authenticate against the Worker.

### A3 — Malicious Fleet Model

The attacker replaces the Ollama model image on a fleet device (e.g.,
`qwen2.5:7b-instruct`) with a poisoned variant that returns subtly incorrect
governance decisions — misrouting baton handoffs, emitting false handoff
signals, or fabricating closeout evidence. HAMR v3 has no model-weight
integrity verification at Ollama pull time.

### A4 — Supply-Chain Attack on Published Bundle

The attacker injects a malicious version of a dependency consumed during
`npx megingjord init` or a Worker deploy. HAMR v3 §1 applies SLSA-L3
provenance and Cosign Bundle 1.0 signing; npm trusted publishing ties publishes
to OIDC-authenticated GitHub Actions runs.

### A5 — MCP Client OAuth Replay

The attacker captures an MCP authorization code or refresh token (network
interception, malicious extension) and replays it to obtain access. HAMR v3 §1
implements OAuth 2.1 with PKCE (prevents code interception) and DPoP (binds
tokens to a client-held key, preventing bearer-token replay).

## 4. STRIDE Walk

### 4.1 A1 — Compromised Cloudflare Account

An account-level compromise (dashboard login or stolen API token) gives the
attacker write access to the Worker route, R2 buckets, and KV namespaces that
underpin HAMR. OIDC federated publishing (hamr-v3 §1) eliminates long-lived
CI tokens; however, interactive dashboard access is outside OIDC scope. The
primary defenses are SLSA-L3 provenance (clients detect tampered bundles) and
Cosign Bundle 1.0 (artifacts are verifiable offline without Rekor round-trips).

| STRIDE | Kill chain | Existing mitigations | Residual | New mitigation |
|---|---|---|---|---|
| **S** Spoofing | Deploy modified Worker impersonating legitimate HAMR Worker | SLSA-L3 provenance + `slsa-verifier` (hamr-v3 §1); OIDC publish binds deploy to repo+branch | LOW | None |
| **T** Tampering | Modify R2 mailbox JSONL objects or KV index; inject malicious A2A envelopes | Cosign Bundle 1.0 covers bundle artifact; R2 messages are not currently signed | MEDIUM | DC-1: HMAC/Ed25519 sign each A2A envelope before R2 write; Worker verifies before processing |
| **R** Repudiation | Suppress Tail Worker logs or redirect to shadow AE dataset | GitHub Actions OIDC deploy log is external to CF; absence of OIDC run detects shadow deploys | LOW | None |
| **I** Info Disc | Read R2 bundle store extracting substrate-health or wiki content | TruffleHog at R2 ingress prevents secrets (hamr-v3 §1); bundle content is non-secret governance instructions | LOW | None |
| **D** DoS | Delete R2 bundle objects; break client bundle fetch | Embedded floor fallback; `hamr:doctor` staleness detection; R2 lifecycle keeps 50 bundles (hamr-v3 §5) | LOW | None |
| **E** EoP | Deploy modified Worker disabling capability manifest enforcement | SLSA + Cosign Bundle 1.0 allows detecting tampered bundle (hamr-v3 §1); DC-2 required to enforce | MEDIUM | DC-2: `hamr:doctor` runs `slsa-verifier`; MCP client blocks connect on unverified bundle |

### 4.2 A2 — Leaked Operator JWT

The operator's `~/.megingjord/identity.json` is a high-value target: it
contains the DPoP-bound JWT that authenticates against the HAMR Worker. DPoP
(RFC 9449, hamr-v3 §1) binds the token to a proof-of-possession key held in
the OS keychain, so a bare JWT cannot authenticate without the private key.
The residual risk concentrates on scenarios where the OS keychain is also
accessible — weak login password, concurrent session compromise, or a platform
without hardware key isolation.

| STRIDE | Kill chain | Existing mitigations | Residual | New mitigation |
|---|---|---|---|---|
| **S** Spoofing | Use exfiltrated JWT to authenticate against `/mcp` | DPoP (RFC 9449, hamr-v3 §1) binds token to OS-keychain private key; bare JWT rejected | MEDIUM | DC-3: DPoP key in Secure Enclave / TPM2 on supported platforms; 4h TTL fallback |
| **T** Tampering | Write malicious content to R2 mailbox using JWT + DPoP key | DPoP TTL limits window (24h rotation, hamr-v3 risk register #1); TruffleHog gate on secrets | LOW | TTL shortening per DC-3 |
| **R** Repudiation | Perform actions attributed to legitimate operator via stolen JWT | Tail Worker logs all authenticated requests with JWT sub claim; post-incident correlation possible | LOW | None |
| **I** Info Disc | Call `/quota` or `/healthz` exfiltrating provider rate-limit state | `/quota`+`/healthz` return operational metadata, not user secrets; bundle hash is public | LOW | None |
| **D** DoS | Flood Batch API or `/quota` to exhaust operator provider quotas | Token-budget-per-task enforcement (hamr-v3 §4); provider 429s + spillover routing | LOW | None |
| **E** EoP | Call Worker endpoint to expand MCP tool scopes beyond capability manifest | Capability manifests are bundle-encoded, Worker-enforced (hamr-v3 §1); no API override path | LOW | None |

### 4.3 A3 — Malicious Fleet Model

This is the highest-risk adversary class. A poisoned Ollama image participates
in the operator's normal workflow: it receives governance prompts via
`cascade-dispatch.js` (S1 §3 REFACTOR target) and returns structured outputs
that are trusted by downstream consumers. HAMR v3 does not verify Ollama model
weight integrity at pull time or at runtime — there is no hash-pinning or
signature check on the model weights. The judge gate in `cascade-dispatch.js`
is the primary defense, but if all fleet devices share the same poisoned image,
the judge produces the same malicious output, bypassing the gate.

| STRIDE | Kill chain | Existing mitigations | Residual | New mitigation |
|---|---|---|---|---|
| **S** Spoofing | Poisoned model fabricates governance artifact (MANAGER_HANDOFF, etc.) with correct `Signed-by` alias | `agent-signature.js` produces textual alias (S1 §3 REUSE); alias is not cryptographically bound | MEDIUM | DC-4: Ed25519 sign all baton handoff artifacts with operator DPoP key; label-lint verifies |
| **T** Tampering | Poisoned model emits false `COLLABORATOR_HANDOFF` with fabricated "all ACs ✅", bypassing Admin review | `cascade-dispatch.js` applies judge gate (S1 §3); judge uses model from same fleet pool | MEDIUM | DC-4: judge gate must use non-fleet (cloud) model for governance-critical verification |
| **R** Repudiation | Poisoned model alters content of messages it formats to suppress audit evidence | Tail Workers log at CF runtime layer independent of model output; model cannot access log emission | LOW | None |
| **I** Info Disc | Poisoned model embeds operator secrets (from context window) in outputs written to R2 or GitHub | TruffleHog at R2 ingress covers known secret patterns (hamr-v3 §1); subtle encoding bypasses TruffleHog | MEDIUM | Restrict fleet context: `cascade-dispatch.js` must not pass `substrate-health.json`, identity material, or raw provider responses to fleet lane |
| **D** DoS | Poisoned model always returns `escalation_needed=true`, exhausting premium token budget | Token-budget-per-task cap (hamr-v3 §4); escalation signal triggers one step, not a loop | LOW | None |
| **E** EoP | Poisoned model posts CONSULTANT_CLOSEOUT on a GitHub issue, triggering closure without legitimate review | Label-lint validates label state on issue events; does not verify cryptographic authenticity of comment | HIGH | DC-4: label-lint CI verifies Ed25519 sig on closeout comment; P1/P2 tickets require manual operator review before close |

### 4.4 A4 — Supply-Chain Attack on Published Bundle

HAMR v3 §1 provides a multi-layer supply-chain defense: SLSA-L3 provenance
attests the build process, Cosign Bundle 1.0 signs the output artifact, npm
trusted publishing ties publishes to OIDC-authenticated Actions runs, and
`wrangler-action@v3` handles CF deployment under GitHub OIDC. These controls
substantially close the direct-publish attack surface. The residual
Tampering risk targets the transitive npm dependency graph of the Worker source
(`cloud/worker/`) — a classic XZ-Utils-style vector where a slow-burn compromise
of a dependency is not caught until after the malicious build ships.

| STRIDE | Kill chain | Existing mitigations | Residual | New mitigation |
|---|---|---|---|---|
| **S** Spoofing | Publish malicious `megingjord@x.y.z` to npm; `npx megingjord init` fetches it | npm trusted publishing (hamr-v3 §1): npm publishes tied to OIDC-authenticated Actions runs; malicious version lacks valid OIDC attestation | LOW | None |
| **T** Tampering | Compromise a Worker npm dependency to inject code that exfiltrates DPoP keys or disables capability manifests | SLSA-L3 attests build inputs; Cosign Bundle 1.0 signs output; Dependabot scoped to `cloud/worker/` (hamr-v3 §5) | MEDIUM | Add `npm audit --audit-level=high` as required CI gate before Worker deploy; generate SBOM alongside SLSA provenance |
| **R** Repudiation | Compromised bundle suppresses Tail Worker logs from within Worker code | Tail Workers run as sibling Worker bound at CF runtime; main Worker cannot suppress invocations | LOW | None |
| **I** Info Disc | Malicious Worker reads DPoP bearer tokens from incoming requests and exfiltrates them | DPoP tokens bound to client key (24h TTL); Cosign verification detects tampered Worker before deploy | LOW | None |
| **D** DoS | Malicious bundle fails all `/bundle` requests, forcing embedded-floor fallback permanently | Embedded floor provides continuity; `hamr:doctor` staleness alert triggers operator remediation | LOW | None |
| **E** EoP | Malicious bundle disables capability manifest enforcement | SLSA + Cosign detection + DC-2 `hamr:doctor` verification gate (see A1-E) | LOW | Conditioned on DC-2 implementation |

### 4.5 A5 — MCP Client OAuth Replay

MCP OAuth 2.1 (hamr-v3 §1, MCP authorization spec 2025-06-18) uses PKCE for
all public clients and DPoP for per-request proof-of-possession. These two
controls together close the classic authorization-code replay and bearer-token
theft vectors. The residual Spoofing risk is specific to the `workers-oauth-
provider` beta library (S6 File A §5.1): if the PKCE code-challenge enforcement
has a defect in the beta implementation, the code-interception protection
degrades. This is a library-quality risk, not a protocol design gap, and is
addressed by pinning + integration-test coverage.

| STRIDE | Kill chain | Existing mitigations | Residual | New mitigation |
|---|---|---|---|---|
| **S** Spoofing | Capture authorization code via network interception; replay to token endpoint | OAuth 2.1 mandates PKCE (hamr-v3 §1, MCP §2.4); intercepted code requires code verifier | MEDIUM | Integration tests must verify PKCE S256 enforcement; pin `workers-oauth-provider` beta release and review PKCE notes per release |
| **T** Tampering | Use captured refresh token to obtain access token; modify MCP tool invocations in transit | DPoP binds tokens to client key; refresh without DPoP key fails; HTTPS (TLS 1.3) protects transit | LOW | None |
| **R** Repudiation | Perform tool calls under legitimate operator identity using replayed token; deny authorship | DPoP proof includes `jti` nonce + `iat` timestamp (RFC 9449 §4.2); nonce replay cache detects duplicates | LOW | Confirm nonce replay cache is implemented in `workers-oauth-provider` integration |
| **I** Info Disc | Replayed authorization code yields access token; call `/quota` or `resources/read` | PKCE prevents code replay (see S above); DPoP prevents access token reuse without private key | LOW | None |
| **D** DoS | Flood `/authorize` endpoint with authorization requests; exhaust Worker CPU or KV write quota | CF Workers request-rate limits bound impact; KV TTLs prevent storage accumulation | LOW | None |
| **E** EoP | Use captured refresh token to request new token with elevated scopes | OAuth 2.1 §4.4 prohibits scope expansion on refresh; capability manifests enforce per-tool scope at MCP wire (hamr-v3 §1) | LOW | None |

## 5. Cross-Cutting Findings

### Worst adversary class

**A3 (Malicious fleet model)** has the highest aggregate residual risk: 4
MEDIUM+ cells and the only HIGH residual in the model (A3-E: fabricated
CONSULTANT_CLOSEOUT). The common root cause is that HAMR v3 provides no
cryptographic integrity verification for fleet model outputs used in governance
decisions. The textual `Signed-by` alias produced by `agent-signature.js`
(S1 §3 REUSE) is not a cryptographic binding — any model that can observe the
alias registry can reproduce it without holding any key material.

The A3-E finding is particularly severe because it targets the terminal baton
transition: a fabricated CONSULTANT_CLOSEOUT can close a GitHub issue, remove
execution-role labels (per ticket-driven-work.instructions.md), and mark work
as done without any legitimate Consultant review. This undermines the entire
governance baton model if left unaddressed.

### Recurring mitigation pattern

**DPoP binding + 24h TTL rotation** (RFC 9449, hamr-v3 §1 + risk register #1)
is the most effective recurrent pattern, closing or significantly reducing
residuals across A2, A4, and A5. It appears in 8 of the 30 STRIDE cells as a
primary or contributing mitigation. Its effectiveness against A2-S is conditioned
on the OS keychain not being simultaneously compromised — the motivation for
DC-3 (hardware key binding via Secure Enclave / TPM2).

**SLSA-L3 + Cosign Bundle 1.0 verification** (A1, A4) is the second most
effective pattern. Its protection against EoP at the deployment level (A1-E,
A4-E) is conditioned on clients running `slsa-verifier verify-artifact` before
connecting to `/mcp`. This client-side obligation is currently unenforced;
DC-2 makes it mandatory in `hamr:doctor` and the MCP pre-connect path.

**Capability manifests** (hamr-v3 §1: per-tool allowlist in the bundle) appear
as a mitigating control in A1-E, A2-E, A4-E, and A5-E. They are consistently
effective because they are bundle-encoded (not runtime-configurable via API call)
and enforced at the Worker MCP wire layer. Their effectiveness is conditioned on
the bundle being unmodified — which circles back to SLSA + DC-2.

### Gap: absence of cryptographic governance artifact signing

No existing HAMR v3 design element cryptographically signs baton handoff
artifacts as they flow through GitHub issues. This single gap enables A3 to
fabricate baton advancement evidence and is the root cause of three of the four
A3 MEDIUM+ residuals (S, T, E). The `agent-signature.js` module (S1 §3 REUSE)
produces a textual `Signed-by:` alias — useful for attribution but not for
integrity verification. DC-4 extends this module to produce an Ed25519 signature
that label-lint CI can verify cryptographically before accepting a baton
transition.

### Interaction between DC-2 and DC-4

DC-2 (SLSA bundle verification gate) and DC-4 (governance artifact signing)
are mutually reinforcing: DC-2 ensures clients operate with an unmodified
Worker and capability manifest, while DC-4 ensures that governance outputs from
any model — including fleet models — are tied to the operator's key material.
Together they close the two highest-impact residuals (A1-E, A3-E) and reduce
the model's MEDIUM+ count from 9 to an estimated 3 (A2-S pending DC-3
hardware availability, A3-I pending context-filtering implementation, A5-S
pending integration-test coverage of PKCE enforcement).

## 6. Required Design Changes

### DC-1 — R2 Mailbox Message Signing

**Forcing finding:** A1-T (MEDIUM).

Before writing an A2A envelope to R2 mailbox, compute an HMAC-SHA256 or Ed25519
signature over the serialized JSONL message using the operator's DPoP key. The
Worker's `/mailbox/read` endpoint verifies the signature before processing.
Messages with invalid or missing signatures are rejected and logged.

Scope: HAMR child 5 (R2 JSONL mailbox + Google A2A envelope, BUILD).

### DC-2 — Mandatory SLSA Bundle Verification in `hamr:doctor`

**Forcing finding:** A1-E (MEDIUM), A4-E (MEDIUM without DC-2).

`hamr:doctor` must run `slsa-verifier verify-artifact` against the active bundle
before reporting `hamr ok`. If verification fails, `hamr:doctor` exits non-zero.
MCP clients must not connect to `/mcp` with an unverified bundle; add a pre-
connect check in the `@modelcontextprotocol/sdk` integration layer.

Scope: HAMR child 8 (`hamr:status` + `hamr:quota` CLIs, BUILD) and child 1
(HAMR core Worker, HYBRID).

### DC-3 — DPoP Key Hardware Binding on Supported Platforms

**Forcing finding:** A2-S (MEDIUM).

On macOS, store the DPoP private key in the Secure Enclave via `keytar` with
`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`. On Linux, use TPM2 via
`tpm2-tss` if available, falling back to the OS keychain. On platforms without
hardware attestation, shorten JWT TTL to 4 hours and document the residual risk
explicitly.

Scope: HAMR child 2 (Substrate-health probe / identity module write path,
BUILD).

### DC-4 — Cryptographic Signing of Governance Artifacts

**Forcing findings:** A3-S (MEDIUM), A3-T (MEDIUM), A3-E (HIGH).

All machine-emitted governance artifacts (MANAGER_HANDOFF, COLLABORATOR_HANDOFF,
ADMIN_HANDOFF, CONSULTANT_CLOSEOUT) must include an Ed25519 signature over the
artifact body, produced using the operator's DPoP key. GitHub issue comments
post the artifact text plus a `sig:` field. Label-lint CI (`label-lint.yml`)
verifies the signature before accepting a baton state transition. The judge gate
in `cascade-dispatch.js` must use a non-fleet (cloud) model for governance-
critical verification, preventing a poisoned fleet from validating its own
outputs.

Scope: Cross-cutting — HAMR children 8 and 9, and an extension of
`agent-signature.js` from textual alias to cryptographic signature output.

## 7. Wiki Ingest Plan

Slug: `hamr-spike-s6-threat-model`

Candidate entity pages:

- `hamr-threat-model` — entity: formal STRIDE analysis; adversary classes
  A1–A5; residual risk table; design changes DC-1 through DC-4.
- `dpop-binding` — concept: RFC 9449 DPoP proof-of-possession; OS-keychain
  key storage; 24h TTL; hardware-binding options (Secure Enclave, TPM2).
- `slsa-bundle-verification` — concept: `slsa-verifier verify-artifact`;
  DC-2 requirement to run before MCP connect; `hamr:doctor` enforcement gate.
- `governance-artifact-signing` — concept: DC-4; Ed25519 signature over baton
  handoff artifacts; label-lint verification; non-fleet judge gate mandate.

Candidate concept pages:

- `fleet-model-integrity` — concept: absence of Ollama model weight integrity
  checks; DC-4 judge-gate non-fleet requirement; A3 threat class.
- `mailbox-signing` — concept: DC-1; HMAC/Ed25519 over R2 JSONL messages;
  Worker-side signature verification before processing.

Ingest command after document is accepted:

```bash
npm run wiki:ingest -- research/hamr-spike-s6-threat-model-2026-05-04.md
```

---

Refs Epic #860, S6 #881, HAMR v3 #873
