---
title: "AC-R7 — Write-path & durability architecture (#3723 mirror-write decision)"
ticket: 3725
epic: 3724
lane: docs-research
ac: AC-R7
last_updated: 2026-07-10
status: ratified
cross_family_receipt: a98ea71552de23b6
related:
  - "[[mem-surface-inventory-3725]]"
  - "[[mem-ac-r5-privacy-scope-3725]]"
  - "[[wiki-multi-repo-write-path-2026-05-07]]"
---

# AC-R7 — Write-path & durability architecture

## Question
Settle the #3723 mirror-write decision (bypass actor vs dedicated mirror branch vs auto-PR/exemption) and its coordination with the #3719 durability slice, under G1/G4.

## The concrete blocker (#3723)
Wiki B mirror automation (`wiki-reconcile-cron.yml`, `wiki-work-log-mirror.yml`) commits as `github-actions[bot]` and pushes **directly to `main`**. Two barriers: (1) `npm ci` installs lefthook, so the bot's push runs the **developer** pre-push suite (fixed necessary-but-insufficient by `--no-verify`); (2) the real wall — the `baton-authority-merge-gate` ruleset (id 18234114) has **`bypass_actors: []`** and requires 8 checks + `baton-authority/merge` on every push → **GH013** rejects any direct push. Mirrors frozen at **2026-06-17** (1170/1176 stale).

## Options & security ranking (SOTA-grounded)
| # | Option | main protection | Unreviewed content reaches main? | Verdict |
|---|---|---|---|---|
| **b** | **Push to a dedicated non-protected branch** (`wiki-mirror`); consumers read from there | **untouched** | **no** | **RECOMMENDED** — cheapest, cleanest for *derived* artifacts; mirrors the T1/T3 tier model |
| c | Bot opens **auto-PR + auto-merge** onto main | checks still gate main | no | acceptable fallback IF mirror must live on main |
| — | *(plumbing for c)* use a **GitHub App installation token / PAT**, not `GITHUB_TOKEN` | — | — | required: `GITHUB_TOKEN`-authored PRs don't trigger `pull_request` check runs (approval-required, stalls auto-merge); a bot also can't approve its own PR |
| **a** | Add the bot/App as a ruleset **bypass actor** | **weakened** | **yes** | **G4 SECURITY CARVE-OUT → client sign-off only** |

Sources: GitHub rulesets/bypass-actors docs; `GITHUB_TOKEN` workflow-trigger constraint; auto-merge-requires-checks docs.

## Decision (recommended — autonomous, non-weakening)
1. **Adopt Option (b): a dedicated non-protected `wiki-mirror` branch** for the derived Wiki B mirror. `main`'s `baton-authority-merge-gate` is **untouched** (G1/G4 preserved); the mirror is a *derived* artifact, so it does not need `main`'s review guarantees. Consumers (`read-router` `mirror-lookup`, dashboards) read from `wiki-mirror`. This is the durability fix #3723 needs **without** weakening branch protection.
2. **If a future requirement forces the mirror onto `main`**, use **Option (c)**: bot opens an **auto-PR driven by a GitHub App installation token** (not `GITHUB_TOKEN`) so required checks actually run and gate the merge; pair with a scoped `CODEOWNERS`/path allowance since a bot can't approve its own PR. Checks still gate `main` — no unreviewed content lands.
3. **Option (a) bypass-actor is explicitly OUT — a G4 security carve-out.** It is the *only* path that lets unreviewed content reach `main`; per the autonomy contract it is **routed to the client** (security-weakening carve-out), time-boxed, and documented if ever chosen. This AC does **not** implement it.
4. **Coordination with #3719:** this Epic settles the *architecture* (b); #3719's durability slice **executes** it (repoint the two workflows to `wiki-mirror`, verify a previously-OPEN mirror flips, backfill the 170 stale). #3723 stays the concrete implementation child, now **unblocked** by this decision.

## Autonomy / carve-out log (explicit)
- **Reversible & autonomously resolvable:** choosing (b) over (c) — a $0 dev architecture decision, ratified by the free panel below (not a bare client prompt).
- **Retained client carve-out (NOT resolved here):** Option (a) — weakening the `baton-authority-merge-gate` ruleset — is a **security-weakening** decision per `config/retained-human-touchpoints.json`; flagged, not taken.

## PANEL SUMMARY
"Settle #3723 by adopting Option (b): the Wiki B mirror automation pushes to a dedicated NON-PROTECTED `wiki-mirror` branch (main's baton-authority-merge-gate ruleset untouched; consumers read from wiki-mirror), because the mirror is a derived artifact that does not need main's review guarantees — this is the durability fix without weakening branch protection. Fallback if the mirror must land on main = Option (c) auto-PR + auto-merge driven by a GitHub App installation token (NOT GITHUB_TOKEN, so required checks run) with scoped CODEOWNERS. Option (a) adding the bot as a ruleset bypass actor is explicitly OUT — it is a G4 security-weakening carve-out routed to the client, not resolved autonomously. #3719 executes the chosen architecture; #3723 is unblocked. Sound and safe under a G4-may-not-weaken constraint?"

## Decision log (G8)
- 2026-07-10 — Recommend Option (b) `wiki-mirror` branch (non-weakening); (c) as on-main fallback with App token; (a) bypass-actor = client-only carve-out. Cross-family panel: receipt above / #3725 comment.
