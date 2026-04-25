# devenv-ops

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20NC%201.0-purple.svg)](LICENSE)
[![Agent Plugin](https://img.shields.io/badge/Agent%20Plugin-governance%20harness-blue.svg)](plugin.json)
[![Node ≥22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

**Governance-first AI agent harness for Copilot, Claude Code, and Codex.**

This repo is the development source for shared runtime assets deployed into `~/.copilot/`, `~/.codex/`, and `~/.agents/skills/`.

## Install

Copilot plugin:
- In VS Code, run `Chat: Install Plugin From Source` and paste this repo’s Git URL.

Codex runtime:
- `npm run deploy:codex:apply`

Both runtimes:
- `npm run deploy:both:apply`

## Runtime mapping

| Source | Runtime target |
|---|---|
| `skills/` | `~/.copilot/skills/` and `~/.agents/skills/` |
| `instructions/` | `~/.copilot/instructions/` |
| `hooks/` | `~/.copilot/hooks/` and `~/.codex/devenv-ops/hooks/` |
| `scripts/global/` | `~/.copilot/scripts/` and `~/.codex/devenv-ops/scripts/` |
| `.codex/` | `~/.codex/AGENTS.md`, `config.toml`, `hooks.json`, and `rules/` |
| `agents/` | `~/.copilot/agents/` |
| `wiki/` | `~/.copilot/wiki/` and `~/.codex/devenv-ops/wiki/` |

## What You Get

- Governance skills, role-baton instructions, routing, secret prevention, wiki knowledge, and dashboard tooling.
- Custom Copilot agents plus Codex/Copilot deploy and sync tooling.
- Shared Team&Model signing and GitHub ticket / PR governance.

## Develop the Harness

```bash
npm run setup              # Install deps
npm start                  # Dashboard on :8090
npm run lint               # ≤100-line file check
npm test                   # Playwright E2E tests
npm run deploy:apply       # Deploy repo → Copilot runtime
npm run deploy:codex:apply # Deploy repo → Codex runtime
npm run deploy:both:apply  # Deploy repo → Copilot + Codex runtimes
```

## Enable in Other Repos

```bash
npm run repo:scope -- enable /path/to/repo
npm run repo:scope -- enable /path/to/repo --target=codex
npm run repo:scope -- list
```

By default the repo-scope tool updates both Copilot and Codex harness scope files.

## Working Rules

- Never share one live checkout between Copilot, Claude Code, and Codex.
- Give each agent family its own worktree and branch.
- Never edit deployed runtimes directly.
- Validate with `npm run lint` and `npm test` before closeout.

## Help

- [Bug reports](https://github.com/chf3198/devenv-ops/issues/new?template=bug-report.yml)
- [Feature requests](https://github.com/chf3198/devenv-ops/issues/new?template=feature_request.md)
- [Contributing](.github/CONTRIBUTING.md)
- [Security](.github/SECURITY.md)

## Label Taxonomy (ADR-010)

Every issue must carry one label from each dimension:

| Dimension | Values |
|---|---|
| `status:` | `backlog` · `triage` · `ready` · `in-progress` · `testing` · `review` · `done` · `cancelled` |
| `type:` | `epic` · `story` · `task` · `bug` · `doc` · `research` |
| `area:` | `dashboard` · `hooks` · `skills` · `instructions` · `agents` · `scripts` · `infra` · `knowledge` |
| `priority:` | `P1` (critical) · `P2` (normal) · `P3` (low) |
| `role:` | `manager` · `collaborator` · `admin` · `consultant` (active baton only) |

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal, educational, nonprofit, and government use. Commercial use requires explicit permission.
