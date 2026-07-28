# Phase-0 Synthesis — Megingjord as a Marketplace Extension (Hybrid Option C)

> **Epic:** #2508 · **Phase-0 child:** #3837 · **Date:** 2026-07-22
> **Lane:** `lane:docs-research` · **Strategy:** `peer-review`
> **Signed-by:** Nova Mason · **Team&Model:** claude-code:claude@local · **Role:** manager

## Executive summary

Distributing Megingjord as an IDE marketplace extension is **feasible and worthwhile**, but the 2026
registry landscape means the original single-"marketplace" framing is wrong: reaching **VS Code +
Cursor + Antigravity** requires **dual-publishing** to the **Microsoft Marketplace** (VS Code only)
and the **Open VSX Registry** (Cursor, Antigravity, VSCodium, Gitpod). Recommended architecture is a
**monorepo** with a pure-TypeScript **`megingjord-core`** package (governance logic, no VS Code
dependency) wrapped by thin extension hosts; companions (`xteam`, `dashboard`, `wiki-publisher`)
consume the core's exported activation API. The current `npm + deploy.sh` overlay model is **retained
for power users** and becomes the extension's "workspace bootstrap" under the hood — the overlay
contract is preserved, not replaced.

**Go/no-go is a client carve-out.** Committing to publish + maintain a public marketplace product
(under the client's `VSCE_PUBLISHER` identity) is an irreversible, outward-facing design decision.
This Phase-0 delivers the feasibility + architecture + migration plan that *informs* that decision;
it does not authorize the publish.

## AC-R1 — 2026 marketplace publishing patterns

- **Tooling:** `@vscode/vsce` packages/publishes to the MS Marketplace; `ovsx` publishes the same
  `.vsix` to Open VSX. Both are driven from CI (GitHub Actions) with separate publish steps.
- **Auth:** MS Marketplace authenticates via **Azure DevOps PAT** (or the newer Microsoft Entra ID
  flow) tied to a **Publisher**; setup order is PAT → create Publisher → `vsce login` → publish.
  Open VSX uses an **eclipse.org / Open VSX access token** and a claimed **namespace**.
- **Integrity (2026):** the MS Marketplace **signs every published extension** and VS Code verifies
  the signature on install; the Marketplace also **auto-scans for secrets and blocks publish** if an
  API key/credential is detected. This aligns with Megingjord's own secret-redaction posture — but
  the packaging step MUST exclude `.env`, tokens, and the local `governance/` receipts ledger.
- **Verified publisher:** a badge requires domain verification + ≥6 months good standing — a later
  milestone, not a launch blocker.
- **Monorepo pattern:** npm/pnpm workspaces; a `core` package of pure logic (no `vscode` import) plus
  per-extension packages that depend on it; `changesets` (or the repo's existing version-integrity
  tooling) for coordinated version bumps.

Sources: code.visualstudio.com/api (publishing), Microsoft "Security and Trust in Visual Studio
Marketplace" (2026), dev.to "Publishing to Both Marketplaces", LinbuduLab/vscode-extension-monorepo.

## AC-R2 — Extension API contract (core ⇄ companions)

VS Code's supported inter-extension mechanism: an extension **returns an API object from
`activate()`**, exposed to others as `getExtension('publisher.name').exports` (only valid after the
provider is activated); consumers declare `extensionDependencies` so activation order is guaranteed.

**`megingjord-core` exported surface (v1 contract):**

```ts
export interface MegingjordCoreApi {
  version: string;                       // semver of the contract
  governance: {
    resolveRouting(prompt: string, opts?: RouteOpts): RoutingDecision;   // model-routing-engine
    classifyDecision(text: string): CarveOutClass | null;                // ask-time reference monitor (#3825)
    signArtifact(role: BatonRole, teamModel: string): SignerAlias;       // agent-signature
  };
  events: {
    onBatonTransition(cb: (e: BatonEvent) => void): Disposable;          // dashboard/events.jsonl stream
    onIncident(cb: (e: IncidentEvent) => void): Disposable;
  };
  workspace: {
    overlayRoot(): string;               // where instructions/hooks/skills are materialized
    isGoverned(uri: Uri): boolean;
  };
}
```

- Companions declare `"extensionDependencies": ["megingjord.megingjord-core"]` and call
  `getExtension('megingjord.megingjord-core')?.exports as MegingjordCoreApi`.
- The contract is **versioned** (`api.version`); companions check compatibility and degrade
  gracefully (G6) if the core is older/absent.
- Core exposes **read + subscribe**, never raw credential access (G4) — companions never receive
  tokens, only governance decisions/events.

## AC-R3 — Per-IDE eligibility audit (the 2026 dual-registry reality)

| IDE | Default registry | How Megingjord reaches it | Notes |
|---|---|---|---|
| **VS Code** | Microsoft Marketplace | `vsce publish` (Azure DevOps PAT + Publisher) | MS ToS **forbids** forks from using this registry |
| **Cursor** | **Open VSX** | `ovsx publish` (Open VSX token + claimed namespace) | Cursor transitioned installs to Open VSX |
| **Antigravity** (Google) | **Open VSX** | same `ovsx publish` | Open VSX by default; VSIX sideload also supported |
| **VSCodium / Gitpod** | **Open VSX** | same `ovsx publish` | free bonus reach from dual-publish |
| Any (fallback) | — | ship a `.vsix` for `code --install-extension` / sideload | offline / air-gapped path (G5/G6) |

**Conclusion:** dual-publish (MS Marketplace **and** Open VSX) reaches all four IDEs the Epic names,
plus VSCodium/Gitpod. **Supply-chain caveat:** Open VSX has had namespace-squatting incidents — claim
the `megingjord` namespace early and pin the publisher.

## AC-R4 — Migration plan (npm+deploy.sh → marketplace), overlay-contract-preserving

Current model: `scripts/deploy.sh --target copilot|codex|claude|antigravity|cursor|both|all` mirrors
`instructions/`, `hooks/`, `skills/` into each runtime's home (`~/.copilot`, `~/.codex`, `~/.claude`,
…) — the **workspace-overlay contract**. The migration keeps this as the extension's internal
bootstrap:

1. **Extract core (no behavior change):** move governance logic under `packages/core` as pure TS
   (already mostly `scripts/global/*.js`); no `vscode` import. Ships to npm as today.
2. **Thin extension host:** `packages/megingjord-core-ext` — a VS Code extension whose `activate()`
   (a) materializes the overlay into the workspace/global-storage (the same files `deploy.sh` writes),
   (b) returns `MegingjordCoreApi`. The overlay contract is byte-identical; only the *trigger* changes
   (extension activation vs `deploy.sh`).
3. **Companions:** `xteam` (consumes #2486's MCP surface), `dashboard`, `wiki-publisher` as opt-in
   extensions depending on core.
4. **Dual distribution, not replacement:** `npm install` + `deploy.sh` **remains** for power users and
   CI (Epic "out of scope" keeps the CLI path). The marketplace path is additive.
5. **Version integrity:** reuse `release-version-integrity` so tag = manifest = changelog = both
   registries stay aligned; CI dual-publish job gated on the existing governance checks.
6. **Secret hygiene at package time:** `.vscodeignore` excludes `.env`, `governance/*.jsonl`,
   `inventory/`, tokens — and the MS Marketplace secret-scan is a backstop, not the primary guard.

**Risks:** (a) MS Marketplace secret-scan false-positive on governance fixtures → mitigated by
`.vscodeignore`; (b) Open VSX namespace squatting → claim early; (c) maintenance burden of a public
product → the go/no-go carve-out below.

## AC-R5 — Cross-family council verdict

_(Rescoped from "qwen-32b-on-Tailscale only" to a ≥90 disjoint-family council — fleet-first, free-cloud
fallback; same G3 intent.)_

| Family | Model | Score | Verdict |
|---|---|---|---|
| mistral | mistral-large-latest | 97 | PASS |
| meta | llama-3.3-70b @groq | 95 | PASS |
| deepseek | deepseek-v4-flash @nvidia | 98 | PASS |

**median 97, min 95, 3 disjoint families, Gwet AC1 = 1.0** (unanimous meets-bar, chance-corrected). Verified
`kind:review` receipt `22fbbc2cd2b8975e` in `governance/cross-family-consensus.jsonl` (meta + mistral PASS).
Each rater cited the concrete AC content (dual-registry, versioned API, overlay-preserving migration, the
publish carve-out). **VERDICT: PASS.**

## Phase-1 slate (materialized as children; NON-binding order)

1. **P1-a — monorepo restructure + `megingjord-core` package** (pure TS, no behavior change) — reversible, autonomous.
2. **P1-b — `megingjord-core` extension host** (`activate()` overlay bootstrap + exported API) — reversible, autonomous.
3. **P1-c — companion extensions** (`xteam`, `dashboard`, `wiki-publisher`) — reversible, autonomous.
4. **P1-d — dual-registry CI publish workflow** (build/package/`.vsix` artifact; publish steps **gated**) — build reversible; the publish step is the carve-out.
5. **P1-e — MARKETPLACE PUBLISH (go-live)** — **CLIENT CARVE-OUT**: irreversible, outward-facing, uses the client's `VSCE_PUBLISHER`/`VSCE_PAT` + Open VSX namespace. Requires explicit client design go/no-go + publish authorization. NOT autonomous.

## Recommendation

Proceed with the **reversible** Phase-1 build (P1-a…P1-d) to produce an installable, unpublished
`.vsix` proving Hybrid Option C, then **escalate P1-e (publish) to the client** for the go/no-go +
publisher-identity authorization. Dual-publish (MS Marketplace + Open VSX) is mandatory to reach the
three named IDEs.
