# Phase-R Independent R&D Prompt

**Audience**: Copilot Team or Codex Team or Claude Code Team session, producing first-pass independent research for a brand-new R&D ticket.

**Use this prompt FIRST**, before `team-prep.md` and `team-init.md`. The synthesis prep + init phases assume each team's R&D artifact already exists in `planning/artifacts/<team-code>-rd.md`. This Phase-R prompt produces that artifact.

**Important**: Phase-R is independent. You do NOT read other teams' R&D in this phase. You produce your own first-pass against the parent ticket's research questions. Read others' R&D only at Phase-P (prep) onward.

## Step 1 — Sync

```bash
git fetch origin
git checkout <synthesis-branch>     # operator provides; e.g. feat/<N>-synthesis-scaffold
git pull --ff-only
```

## Step 2 — Determine your team code, alias, model

Same rules as `team-prep.md` Step 2:

- Team codes: `cc` (Claude Code), `cp` (Copilot), `cx` (Codex)
- Alias: derive from `inventory/team-model-signatures.json` registry
- Critical: Copilot Team must NOT use a `gpt-5.*codex` model (that belongs to team `codex`); switch to a Copilot-native model first
- Sign with team's derived alias, NOT operator handle (`chf3198`)

## Step 3 — Read the parent R&D ticket

The operator will tell you the R&D ticket number when sending this prompt. Read:

- The R&D ticket body (research questions, deliverables, constraints)
- The parent Epic body (context, scope, ACs)
- Any referenced existing artifacts (`scripts/global/...`, `instructions/...`, prior R&D in `research/`)
- `inventory/team-model-signatures.json` and any other inventory files relevant to the question

**Do NOT read** other teams' R&D files in `planning/artifacts/` if any exist. They are out of scope for Phase-R.

## Step 4 — Produce your independent first-pass artifact

Create `planning/artifacts/<your-team-code>-rd.md`. **Required sections**:

1. **Header**: parent Epic, R&D ticket, date, your team, your model, your alias, your role
2. **Contamination declaration**: explicitly state what you read before producing this artifact (issue threads viewed, files opened, web searches run). Honesty is required — synthesis depends on knowing what each team's perspective drew from.
3. **Source inventory**: what you grep'd / read / inspected
4. **Per-question response**: address each research question from the parent ticket; cite evidence as `repo: path/file.ext#L<start>-L<end>` or `websearch: <URL> (accessed <UTC>)`
5. **Conflict / opportunity matrix**: if applicable, severity-classified
6. **Proposal**: your team's recommended approach (be opinionated; the synthesis stage will reconcile across teams)
7. **Rollout sketch**: child-ticket sequence + effort + dependencies (rough; precise plan emerges from synthesis)
8. **Self-rating**: score your own pass against G1..G9 goal constitution (1-10 per goal, with rationale)
9. **Sign-off**: full Team&Model trailer

## Step 5 — Length and depth

- Target: 100-300 lines
- Be specific: file:line evidence for every claim
- If you're unsure, say so; uncertainty is cheaper to flag in Phase-R than to discover at synthesis
- WebSearch is welcomed but optional — repo evidence and grep-able inventories carry equal weight

## Step 6 — Commit + signal completion

```bash
git add planning/artifacts/<your-team-code>-rd.md
git commit -m "research(<team>): independent R&D for #<NNN> Phase-R"
git push origin <synthesis-branch>
```

Reply to the operator:

```
RD-COMPLETE: <team-code> as <alias>, <Team&Model>, artifact at
planning/artifacts/<team-code>-rd.md, <line-count> lines.
```

After all three teams report `RD-COMPLETE`, the operator sends the prep prompt. Phase-P (synthesis prep) reads all three artifacts.

## What NOT to do in Phase-R

- Do NOT read other teams' R&D artifacts (preserves independence)
- Do NOT post positions, threads, or decisions (those are Phase-S/init)
- Do NOT touch `planning/protocol.md`, `planning/decisions.md`, `planning/status.md`, `planning/pulse.json` (admin-only)
- Do NOT propose implementation tickets (that's after operator approves the synthesis output)

## Why Phase-R exists

The previous synthesis (#1105) had R&D artifacts authored over prior days, then converged. For brand-new R&D tickets like #1131, there's no pre-existing research — this prompt fills the gap so synthesis prep+init has actual artifacts to work with.
