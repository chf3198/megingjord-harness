---
title: "DevEnv Fleet Topology"
type: source
created: 2026-04-14
updated: 2026-04-14
tags: []
sources: [raw/articles/devenv-fleet-topology.md]
related: []
status: draft
---

# DevEnv Fleet Topology

## Summary

## Summary
A three-device development and inference setup using Tailscale mesh is described. The devices include a primary Chromebook (penguin) for the IDE host, a secondary Chromebook (penguin-1) for Ollama with limited resources, and a Windows laptop (windows-laptop) for running OpenClaw/LiteLLM gateway and more resource-intensive Ollama tasks. The routing strategy separates fleet-lane tasks to OpenClaw, free-lane tasks to local tools or free cloud APIs, and premium-lane tasks to Copilot Pro. The setup has constraints due to limited RAM on the primary Chromebook, with inference offloaded to the laptop via Tailscale VPN, and a memory watchdog monitoring for OOM conditions during heavy operations.

## Entities
- penguin (Primary Chromebook IDE host)
- penguin-1 (Secondary Chromebook)
- windows-laptop (inference host)
- VS Code
- Copilot agent
- dashboard server
- Ollama
- Phi-3.5 mini
- OpenClaw/LiteLLM gateway
- Groq
- Cerebras
- Copilot Pro (Anthropic, OpenAI)
- Tailscale VPN
- memory watchdog

## Concepts
- Three-device development and inference setup using Tailscale mesh.
- Routing strategy for different types of tasks.
- Limited RAM constraint on primary Chromebook.
- Offloading inference to a more powerful device via Tailscale VPN.
- Monitoring for Out Of Memory (OOM) conditions with a memory watchdog.

*Source: raw/articles/devenv-fleet-topology.md*