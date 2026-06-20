---
title: "Fleet inventory overlay, onboarding, and git remediation (Phase-0 #3163 / Epic #3162)"
date: 2026-06-20
epic: 3162
ticket: 3163
lane: docs-research
test_strategy: peer-review
status: draft
operator_decisions: B1-B4 (recorded on #3162)
---

# Fleet inventory overlay, onboarding, and git remediation

Phase-0 design for Epic #3162. Closes docs/code drift (overlay never wired), IT inventory edit class, split-brain dashboard credentials, and committed operator topology. Consumes closed Epic #2291 (hydration + secret storage); coordinates with #2803 (dashboard tri-mode).

## Operator binding constraints (not re-litigated)

| ID | Decision |
|----|----------|
| B1 | Generic templates only in git; operator fleet local-only |
| B2 | Git history cleanup required (executable plan) |
| B3 | Dashboard-first wizard; keychain primary, `.env` fallback (#2291 D6) |
| B4 | Dashboard approved credential interface when industry-safe |

## D1 — Inventory consumer map (AC-R1)

| Consumer | File(s) read | Write path today | Target read (Phase-1) |
|----------|--------------|------------------|-------------------------|
| fleet-config.js | repo devices.json | none | `resolveInventory()` merge |
| fleet-router.js | devices + latency-profile | bench only | merged inventory |
| capability-probe.js | repo devices.json | `.dashboard/capabilities.json` | merged inventory |
| task-router.js | devices + ai-models | none | merged + generic ai-models |
| fleet-profile-bench / benchmark-runner | repo devices | latency-profile (repo) | merged; latency → `~/.megingjord/` |
| fleet-discover.sh | tailscale | `~/.megingjord/devices.json` | unchanged |
| dashboard device-monitor | fetch repo JSON | none | `/api/fleet/inventory` merged view |
| fleet-settings.js | localStorage | localStorage | **deprecated** → setup API |
| credential-store.js | localStorage | localStorage | **deprecated** → setup API |
| dashboard-server | load-local-env `.env` | none | setup API writes keychain/`.env` |
| Skills / docs | prose references | n/a | sync post-impl |

**Gap:** 11 runtime consumers; only discover + probe write local state; overlay never merged.

## D2 — Local vs repo-canonical policy (AC-R2)

| Asset | Repo (git) | Operator local | Ephemeral |
|-------|------------|----------------|-----------|
| devices topology | `devices.example.json` only | `~/.megingjord/devices.json` + discover | capabilities.json |
| ai-models routing rules | generic `ai-models.example.json` (new) | `~/.megingjord/ai-models.json` optional overrides | — |
| services registry | generic `services.example.json` (new) | `~/.megingjord/services.json` | probe health |
| fleet-latency-profile | `latency-profile.example.json` (new) | `~/.megingjord/fleet-latency-profile.json` | bench refresh |
| API keys / tokens | `.env.example` (names only) | keychain → `.env` fallback | never |
| Tailscale IPs | never | `.env` FLEET_IP_* or overlay | probe |

Tracked `inventory/devices.json` (operator-specific) **removed** after migration; CI uses examples + fixtures.

## D3 — Overlay merge spec (AC-R3) — ADR-011 Tier 1+2

New module `scripts/global/resolve-inventory.js` (≤100 lines; split if needed):

```
resolveInventory(kind) =
  deepMerge(
    loadExampleOrEmpty(kind),           // repo *example.json
    loadLocal(`~/.megingjord/${kind}`),  // operator overlay
    envOverrides(FLEET_IP_*, FLEET_URL_*),
    optionalProbeOverlay(capabilities)  // read-only enrich, never persist to git
  )
```

Precedence: **explicit env > local overlay > example baseline**. Missing overlay → solo mode (example + env). Air-gap: no network; static example + `.env` suffices.

Device merge: match on `id`; overlay fields replace baseline per device. Models list: overlay replaces `ollamaModels` array entirely when present.

## D4 — IT vs Collaborator runbook (AC-R4)

| Action | IT / agent | Collaborator ticket |
|--------|------------|---------------------|
| `npm run capability:probe` | ✅ | — |
| `bash scripts/global/fleet-discover.sh` | ✅ | — |
| Dashboard Fleet Setup wizard | ✅ (writes local only) | — |
| `.env` / keychain via terminal | ✅ | — |
| Remote Ollama/LiteLLM host config | ✅ | — |
| Edit repo `inventory/*example*` | — | ✅ |
| Git history rewrite | — | ✅ (Admin Phase-1) |
| pretool guard / gitignore changes | — | ✅ |

## D5 — Git protection + history remediation (AC-R5, AC-R7)

### Forward guards (Phase-1)

- `.gitignore`: add `inventory/devices.json`, `inventory/ai-models.json`, `inventory/services.json`, `inventory/fleet-latency-profile.json` (keep `*.example.json` tracked).
- `pretool_guard.py`: block commits touching non-example inventory unless `Refs #N` + maintainer label.
- CI: `inventory-portability-check.js` — fail if tracked inventory contains non-example hostnames/100.x Tailscale IPs.
- detect-secrets + gitleaks (existing G4 chain).

### History remediation plan

1. **Inventory content scrub:** Replace tracked files with generic examples (content from `devices.example.json` pattern); operator data already in local overlay export backup.
2. **History rewrite:** `git filter-repo --path inventory/devices.json --path inventory/ai-models.json --path inventory/services.json --replace-text expressions.txt` removing 100.x IPs and operator hostnames from all commits. Requires force-push + collaborator notice (public repo risk: LOW if no secrets in inventory — IPs/hostnames only).
3. **Alternative if rewrite blocked:** Forward-only scrub on main + `inventory/OPERATOR-DATA-REMOVED.md` pointer; history retains IPs (G4 partial fail) — **not recommended** per operator B2.

Secrets in inventory: audit shows **no API keys** in inventory JSON; Tailscale IPs and hostnames only (privacy, not credential class).

## D6 — First-install bootstrap (AC-R8)

```
git clone → npm install → npm run deploy:both:apply
→ npm start (Dashboard :8090)
→ First-run modal: "Fleet Setup" (blocks nothing; degrades gracefully)
   Step 1: Tailscale status (auto)
   Step 2: Discover tailnet → ~/.megingjord/devices.json
   Step 3: Credential wizard (cloud keys optional)
   Step 4: Probe → capabilities.json
   Step 5: Doctor summary
```

CLI parity: `npm run harness:setup` (= probe + discover + credential check), `npm run harness:doctor` (readiness report). Document in `docs/howto/installation.md`.

## D7 — Agent IT fleet setup (AC-R9)

IT agent script chain (non-commitable):

1. `tailscale status --json` — verify auth
2. `bash scripts/global/fleet-discover.sh`
3. Dashboard API `POST /api/fleet/setup/credentials` OR `node scripts/global/harness-credential-set.js --name OPENROUTER_API_KEY` (terminal, no chat)
4. `npm run capability:probe`
5. `node scripts/global/fleet-config.js profile`

`preCredentialPromptCheck` before any credential ask. Skill update: `fleet-portable-config`, `role-it-execution` adapter.

## D8 — Dashboard fleet setup unification (AC-R10)

**Problem:** localStorage keys invisible to Node scripts.

**Design:** New dashboard API routes (dashboard-server.js handlers split ≤100 lines):

| Route | Method | Writes |
|-------|--------|--------|
| `/api/fleet/setup/status` | GET | read merge + probe age |
| `/api/fleet/setup/discover` | POST | run discover.sh |
| `/api/fleet/setup/credentials` | POST | `{name, value}` → keychain if `MEGINGJORD_KEYCHAIN` set else append `.env` (atomic write, redacted logs) |
| `/api/fleet/setup/probe` | POST | capability-probe |

UI: replace `fleet-settings.js` localStorage keys with wizard; keep UI preferences in localStorage only (refresh interval, contrast). **Never** store API keys in localStorage (G4).

Coordinate #2803: Local Mode only for writes; GitHub Pages demo uses fixtures; Webview postMessage read-only.

## D9 — Credential onboarding (AC-R11)

Aligns #2291 D6 + 2026 industry synthesis (env.dev, Logto CLI guide, gh keychain pattern):

| Tier | Mechanism | When |
|------|-----------|------|
| 1 | OS keychain via `getCredential()` | MEGINGJORD_KEYCHAIN set |
| 2 | gitignored `.env` via wizard atomic write | fallback / air-gap |
| 3 | Manual `.env` edit | power users |
| Reject | localStorage secrets, chat paste, tracked git | always |

Future (Phase-2 sketch, not Phase-1): MCP proxy-token injection for agents (Pincer pattern) — out of scope unless AC-E8 added later.

## D10 — Phase-1 child ticket decomposition

| # | Title | AC summary | Refs |
|---|-------|------------|------|
| 3164 | resolve-inventory.js + fleet-config/router/probe wiring | merge works; tests | #3163 D3 |
| 3165 | Example-only inventory migration + gitignore guards | no operator data in git | #3163 D2,D5 |
| 3166 | Git history scrub (inventory paths) | filter-repo executed | #3163 D5 |
| 3167 | Dashboard fleet setup API + wizard UI | keychain/`.env` writes | #3163 D8 |
| 3168 | harness:setup + harness:doctor + installation.md | ≤5 step bootstrap | #3163 D6 |
| 3169 | IT skill/docs sync + inventory-portability CI check | fleet-portable-config truth | #3163 D4,D7 |

Epic AC-E1–E7 map 1:1 to children above.

## D11 — Risks and mitigations

| Risk | Mitigation |
|------|------------|
| filter-repo breaks forks | Announce; tag pre-scrub; document re-clone |
| Dashboard writes corrupt `.env` | atomic write + backup `.env.bak` + validate names |
| Solo user without Tailscale | example + `.env` cloud keys only |
| #2803 merge conflict | 3167 targets Local Mode panel only; coordinate branch |

## D12 — Goal-lens evidence matrix (AC-R6)

| Goal | Design element | Score rationale |
|------|----------------|-----------------|
| G1 | IT runbook D4; pretool guard; ticket-gated example edits; baton on #3162 | Explicit role boundaries |
| G2 | 6 scoped children; resolve-inventory unit tests; inventory-portability CI | Testable AC per child |
| G3 | No Doppler/Vault mandate; fleet probe local; #2291 D6 rejects paid vault primary | Zero-cost default |
| G4 | filter-repo; gitignore; no localStorage keys; keychain-first; detect-secrets | Operator data out of git |
| G5 | example+overlay; air-gap solo mode; MEGINGJORD_NO_DOTENV opt-out | Works offline |
| G6 | Missing overlay degrades to example; keychain fail → .env; probe optional | Graceful fallbacks |
| G7 | Dashboard 5-step wizard; harness:doctor one command | Low onboarding friction |
| G8 | capability-probe manifest; env-hydrate names-only audit; setup audit log | Observable without values |
| G9 | Same stores for dashboard/CLI/IT agents; loadLocalEnvOnce all runtimes | Cross-runtime parity |

**Min-goal floor target:** ≥93 on min(G1..G9) after cross-family review.

## D13 — Verification gates (Phase-1)

| Child | test_strategy | Evidence |
|-------|---------------|----------|
| 3164 | tdd-pyramid | tests/resolve-inventory.spec.js |
| 3165 | tdd-pyramid+golden-file | example fixtures; gitignore grep |
| 3166 | manual-verify | filter-repo log + pre/post IP grep |
| 3167 | tdd-pyramid+visual-regression | API tests + dashboard panel |
| 3168 | manual-verify | installation.md walkthrough |
| 3169 | drift-lint | skill/doc contract test |

## Operator discussion agenda (resolved)

All four forks closed by operator comments on #3162 (B1–B4).

Signed-by: Rex Research
Team&Model: Claude Code / claude-4.6-sonnet-medium-thinking
Role: Collaborator
