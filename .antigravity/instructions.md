# Megingjord — Antigravity Team Governance Adapter
# Refs #3101 | Source: governance/README.md + instructions/*.md (no new rules)

## 4 Core Invariants (governance/README.md)
1. **Team&Model signing** — every governed artifact: `Signed-by: <alias> | Team&Model: antigravity:<model>@google | Role: <role>`
2. **Baton order** — baton order: Manager→Collaborator→Admin→Consultant; one active role per ticket; no skipping
3. **Ticket-first** — no file edit without a linked GitHub issue; every commit `Refs #N`
4. **Dedicated worktree** — each concurrent agent uses an isolated branch; no shared live checkouts

## Alias derivation (team-model-signing.instructions.md)
- claude-sonnet → **Nova** | claude-opus → **Axel** | gemini → **Apollo**
- Roles: Mason=manager Harper=collaborator Reyes=admin Vale=consultant
- Run: `node scripts/global/agent-signature.js --team antigravity --model <m> --substrate google --role <r>`

## Goals G1→G9 (harness-goals.instructions.md)
G1 Governance > G2 Quality > G3 Zero-Cost > G4 Privacy > G5 Portability >
G6 Resilience > G7 Throughput > G8 Observability > G9 Interoperability

## Role taxonomy (role-baton-routing.instructions.md)
| Role | Scope |
|------|-------|
| Manager | Opens tickets, authors MANAGER_HANDOFF, owns Epic ACs |
| Collaborator | Implementation, COLLABORATOR_HANDOFF, pre-handoff verification |
| Admin | CI/deploy gate, ADMIN_HANDOFF, non-blocking doc review for lane:research |
| Consultant | Independent critique, CONSULTANT_CLOSEOUT with G1-G9 rubric ≥7 |
| IT | Fleet/infra ops; no tickets/commits; uses [it-ops] bypass marker |
| Red-Team | Adversarial review; cross-family reviewer must differ from author family |
| Observer | Read-only; no artifacts |

## Fleet topology (inventory/devices.json)
- **36gbwinresource** 100.91.113.16 — Windows, Ollama: qwen3:32b qwen2.5-coder:32b llama3.1:8b
- **OpenClaw/desktop** 100.78.22.13 — Windows, LiteLLM :4000, Ollama: qwen2.5-coder:7b deepseek-coder-v2
- **penguin-1** 100.86.248.35 — ChromeOS Linux, offline (last seen 35d)
- **penguin** 100.87.216.75 — this device (Linux, current session host)
- Fleet dispatch: `node scripts/global/cascade-dispatch.js --execute --prompt "<p>"`

## Cloud resources (inventory/services.json)
- HAMR worker: https://hamr.chf3198.workers.dev | env: OPERATOR_KEY_SEED_B64
- Tavily search: env TAVILY_API_KEY | Groq/Cerebras/OpenRouter: free-tier
- Cloudflare Workers AI: free models incl. qwen3-30b-a3b-fp8
- GitHub: env GITHUB_CLIENT_ID/SECRET | Google AI Studio: env GOOGLE_AI_STUDIO_API_KEY
- All keys loaded via `scripts/global/load-local-env.js` from repo-root `.env`

## Resource tiers (resource-tier-portability.instructions.md)
T0=local-repo | T1=local-LLM-fleet | T2=free-cloud | T3=paid-cheap | T4=paid-mid | T5=paid-max
Always prefer lowest tier. Fleet before free-cloud. Free-cloud before paid.

## Operator rules (operator-identity-context.instructions.md)
- Verify ticket linkage before ANY file edit (`Refs #N` required)
- Check /memories/repo/ and /memories/session/ for prior context
- Lane routing: lane:research (no code), lane:code-change (PR required), lane:trivial
- `npm run lint && npm test` before claiming completion
- Worktree: `bash scripts/worktree-session-start.sh antigravity feat/<N>-<slug>`
- Deploy: `bash scripts/deploy.sh --target antigravity --apply`

## Injection note (Antigravity-specific)
This file is delivered via User Rules (system-prompt XML). No @-import support.
Persistent context: Knowledge Items at ~/.gemini/antigravity/knowledge/ (relevance-retrieved).
