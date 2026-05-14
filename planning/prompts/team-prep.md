# Team Prep — Cross-Team R&D Synthesis

**Audience**: Copilot Team or Codex Team session, preparing to participate in Epic #1103 / R&D #1105 synthesis.

**This phase is read-only. Do NOT post any positions yet.** You will receive a separate Init prompt when it's time to write.

## Step 1 — Sync

```bash
git fetch origin
git checkout feat/1105-synthesis-scaffold
git pull --ff-only
```

## Step 2 — Determine your team code and alias (READ THIS CAREFULLY)

**Your team code is determined by which extension panel you are running in — NOT
by which model is active.** Model routing (e.g. Copilot Auto) never changes your team.

| Panel / substrate | Team code | substrate value |
|---|---|---|
| GitHub Copilot Chat | `cp` | `github-copilot` |
| Codex CLI or VS Code Codex panel | `cx` | `codex-cli` / `codex-vscode-ide` |
| Claude Code CLI | `cc` | `claude-code-cli` |

Your **registry-derived alias** is computed from `inventory/team-model-signatures.json`:

1. Confirm your substrate from the table above — this is your canonical team.
2. Find the registry entry matching your team + active model for the `aliasSeed`.
3. Your **surname** rotates by role: `manager` → Mason, `collaborator` → Harper,
   `admin` → Reyes, `consultant` → Vale.
4. Combine: `<aliasSeed> <role-surname>` is your `Signed-by` value.

**Critical**: Do NOT sign as `chf3198`. Sign with your AI agent alias.
**Critical**: Copilot Auto may route to `gpt-5.3-codex` — you remain team `cp`.
Sign as `copilot:gpt-5.3-codex@github-copilot`. Do NOT switch models to work around this.

## Step 3 — Read scaffolding

In this order:

1. `planning/protocol.md` — full structural protocol (read end-to-end)
2. `planning/README.md` — quick-start
3. `planning/artifacts/INDEX.md` — section-level reference table for cross-refs
4. `planning/artifacts/cc-rd.md` — Claude Code Team R&D
5. `planning/artifacts/cp-rd.md` — Copilot Team R&D
6. `planning/artifacts/cx-rd.md` — Codex Team R&D
7. `planning/artifacts/cc-critique.md` — Claude Code earlier critique (contains a known factual error corrected in [CC-RD §0.2])
8. `planning/positions/cc.md` — existing Claude Code positions (reference only — do NOT touch)
9. `planning/positions/cx.md` — existing Codex positions (reference only — do NOT touch)
10. `planning/positions/cp.md` — your team's file (will be written in Init phase)
11. `planning/status.md` — current synthesis state + 11 provisional decisions D-001..D-011

## Step 4 — Internalize the rules

Before posting anything in the Init phase:

- **Files you may write**: `planning/positions/<your-team-code>.md` only (append-only). And `planning/threads/T-<your-team-code>-NNN-*/<your-team-code>.md` if you open threads (none currently exist).
- **Files you must NEVER touch**: any other team's position or thread file; anything in `planning/artifacts/`; the admin-maintained `status.md`, `decisions.md`, `pulse.json`.
- **Sign-off format**: per `protocol.md` §5. YAML block per decision. Evidence MUST use `repo: path/file.ext#L<start>-L<end>` line anchors and `websearch: <URL> (accessed <UTC>)` timestamps.
- **Anti-spam**: once you post `quiescent: true` on a decision, do not post again on that decision unless **new evidence changes your verdict**.

## Step 5 — Confirm readiness

Reply to the operator with a single line:

```
READY: <team-code> as <Signed-by alias>, <Team&Model> string
```

Example: `READY: cp as Soren Vale, copilot:claude-sonnet-4-6@github-copilot`

The operator will then send the Init prompt.
