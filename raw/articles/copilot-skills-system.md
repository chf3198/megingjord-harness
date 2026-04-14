---
title: "Copilot Skills System"
date: 2026-04-14
source_url: skills/
author: devenv-ops
tags: [skills, copilot, governance, agents]
status: ingested
---

# Copilot Skills System

33 global skills deployed from devenv-ops to ~/.copilot/skills/.
Each skill is a SKILL.md file with structured instructions.

## Skill Categories

- **Role Baton**: manager, collaborator, admin, consultant execution
- **GitHub Ops**: ticketing, review/merge, rulesets, releases
- **Fleet Routing**: task router, OpenClaw, network platforms
- **Repo Standards**: onboarding, structure, profile governance
- **Specialized**: Playwright vision, mem watchdog, secret prevention

## Architecture

Skills are Markdown files with domain-specific knowledge.
The agent loads skills on demand via file reads. Skills never
modify each other — they compose through the baton workflow.

## Deploy Flow

1. Edit skills/ in devenv-ops repo (development source)
2. Test behavior in Copilot Chat
3. Merge to main
4. Run `npm run deploy:apply` to copy to ~/.copilot/skills/

## Key Skills

- operator-identity-context: Session authority and mandate
- role-baton-orchestrator: Manager→Collaborator→Admin→Consultant
- global-task-router: Free/fleet/premium lane classification
- openclaw-universal-system: Gateway routing and failover
