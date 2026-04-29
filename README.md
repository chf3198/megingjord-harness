# Megingjord Harness

![Megingjord Banner](https://capsule-render.vercel.app/api?type=waving&height=180&text=Megingjord%20Harness&fontSize=44&fontColor=ffffff&color=0:1f6feb,100:5f2c82&desc=Governance-first%20AI%20agent%20orchestration%20for%20Copilot%20%7C%20Claude%20Code%20%7C%20Codex&descAlignY=68)

[![License: PolyForm NC](https://img.shields.io/badge/License-PolyForm%20NC%201.0-blue.svg)](LICENSE)
[![Node >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![Plugin](https://img.shields.io/badge/Agent%20Plugin-Megingjord%20Harness-0a66c2.svg)](plugin.json)
[![Runtime](https://img.shields.io/badge/runtime-Copilot%20%2B%20Codex%20%2B%20Claude-7c3aed.svg)](AGENTS.md)

**Megingjord** is a governance-first AI agent harness with skills, hooks, agents, runtime scripts, and a Karpathy-style LLM wiki.

## Architecture at a glance

```mermaid
flowchart LR
	A[Repo Source] --> B[skills/ instructions/ hooks/ scripts]
	B --> C[~/.copilot runtime]
	B --> D[~/.codex/megingjord-harness runtime]
	B --> E[~/.agents/skills runtime]
	C --> F[Governed agent execution]
	D --> F
	E --> F
```

## Why it is robust

- Multi-runtime deployment model with dry-run/apply scripts
- Governance baton model: Manager → Collaborator → Admin → Consultant
- Fleet-aware routing, telemetry, and policy enforcement
- Static dashboard with operations + governance visibility
- LLM wiki integration for reusable institutional knowledge

## Quick start

```bash
npm run setup
npm start
npm run lint
npm test
npm run deploy:both:apply
```

## Public trust surfaces

- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Support](SUPPORT.md)
- [License](LICENSE)

## Runtime mapping

| Source | Runtime target |
|---|---|
| skills/ | ~/.copilot/skills + ~/.agents/skills |
| instructions/ | ~/.copilot/instructions |
| hooks/ | ~/.copilot/hooks + ~/.codex/megingjord-harness/hooks |
| scripts/global/ | ~/.copilot/scripts + ~/.codex/megingjord-harness/scripts |
| .codex/ | ~/.codex/AGENTS.md + config.toml + hooks.json + rules/ |
| wiki/ | ~/.copilot/wiki + ~/.codex/megingjord-harness/wiki |

## Issue flows

- [Bug report](https://github.com/chf3198/megingjord-harness/issues/new?template=bug-report.yml)
- [Feature request](https://github.com/chf3198/megingjord-harness/issues/new?template=feature_request.md)
- [Discussions](https://github.com/chf3198/megingjord-harness/discussions)

> Formerly DevEnv Ops. Codex name rejected due product conflict; Aegis rejected due broad name reuse.
