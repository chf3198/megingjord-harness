# How-to: Run a cross-team R&D synthesis

Canonical pattern per `instructions/cross-team-rd-synthesis.instructions.md` (v3, shipped #2402).

## When to use

For an Epic whose scope spans multiple architectural surfaces or whose answers benefit from independent perspectives (security + performance + UX trade-offs). Example: #1105 (3-team R&D for harness convergence) where each team surfaced findings the others missed.

## Prerequisites

- The Epic ticket exists in GitHub with `type:epic` label
- 3-4 AI agent orchestrator teams available (Claude Code, Codex, Copilot, Antigravity)
- Operator has `~/devenv-ops/` checkout + GitHub credentials (Tier-1 baseline; HAMR R2 is Tier-2 optimization)

## Steps

### 1. Scaffold the synthesis tree

```bash
npm run synthesis:init -- --epic <N>
```

Creates `planning/synthesis-<N>/` with:
- `artifacts/` (per-team Phase-R outputs)
- `positions/{cc,cp,cx,ag}.md` (per-team append-only logs)
- `decisions.md` (admin-curated D-IDs)
- `pulse.json` (kickoff timestamp + admin team via `teams[N % len(teams)]`)
- `status.md` (current phase + wave)
- `stability.json` (K-S adaptive termination state)

Override admin via `--admin-team <code>`. Default rotation per v3 §1 (#2394 conclusion).

### 2. Dispatch Phase-R prompts

Render the three canonical prompts for each team:

```bash
node scripts/global/synthesis-prompt-render.js team-prep \
  --epic_n <N> --team_code cc --team_alias "Orla Harper"
```

Operator-initiated kickoff per v3 §5 dispatcher (#2393 hybrid recommendation). Lead-team substrate determines lead team per v3 §1.

### 3. Phase-D iterative debate

After Phase-R artifacts land, admin facilitates iterative debate waves. The 6h cron job (`.github/workflows/cross-team-rd-snapshot.yml`) runs `npm run synthesis:snapshot -- --epic <N>` automatically; manual invocation also available.

Each snapshot:
- Reads wave decision distributions from `decisions.md`
- Computes K-S 2-sample p-value vs prior wave
- Appends p-value to `stability.json`
- Returns `terminate=true` when 3 consecutive p-values < 0.05 OR 24h ceiling elapsed (#2396 conclusion)
- Exit code 2 signals TERMINATE_SYNTHESIS to the workflow

### 4. Check live status anytime

```bash
npm run synthesis:status -- --epic <N>
```

Emits JSON summary (admin, kickoff, phase, wave, elapsed/remaining hours, latest K-S p-value).

### 5. Phase-C closeout

When TERMINATE_SYNTHESIS triggers, lead-team Manager → Admin → Consultant per `instructions/role-baton-routing.instructions.md`. Implementation children for the parent Epic are filed by the lead-team Manager after Phase-C closes.

## Tier-graceful behavior

Per `instructions/harness-goals.instructions.md` Tier-graceful degradation pattern (#2400):
- Tier 1 default: GitHub Actions schedule + `.gnap/dispatch/<team>/<ts>.json` git-board transport
- Tier 2 optimization: HAMR R2 mailbox + HAMR cron when `MEGINGJORD_HAMR_DISABLED` is unset
- The fallback IS the default; the optimization IS the upgrade

## Troubleshooting

| Symptom | Resolution |
|---|---|
| Phase-D never terminates | Check `stability.json`; if p-values are consistently > 0.05, decisions are diverging — admin facilitation needed |
| 24h ceiling triggered before consensus | Re-scope Epic; multi-wave run may be unrealistic at the original complexity |
| TEAM_RESPONSE signer-fidelity violation at CI | Verify signer alias derives from `inventory/team-model-signatures.json` per the #2370 validator |
| Snapshot job fails on missing pulse.json | Re-run `npm run synthesis:init -- --epic <N>` |

## References

- `instructions/cross-team-rd-synthesis.instructions.md` — canonical v3 protocol
- Epic #1112 — productization parent
- #2393 dispatcher · #2394 admin rotation · #2395 fanout · #2396 termination
- #2400 tier-graceful pattern · #2370 cross-team-response-fidelity validator
- `wiki/wisdom/global/concepts/cross-team-rd-synthesis.md` — concept page
