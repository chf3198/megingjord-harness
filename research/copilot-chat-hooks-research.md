# Copilot Chat Hooks Research

## Overview
This document outlines research and design for integrating Copilot Chat hooks with the devenv-ops agent system. The goal is to enable seamless handoffs between Copilot Chat sessions and specialized agents via baton routing.

## Current State
- Baton workflow uses `baton:handOff` traces for role transitions
- No direct Copilot Chat integration exists
- Adapter skeleton in `scripts/copilot-chat-adapter.js` provides basic interface

## Proposed Architecture
### Inbound Hooks
- Webhook receiver for Copilot Chat events (message received, session started)
- Parse user intent and route to appropriate agent lane (free/fleet/premium)
- Trigger baton handoff if complex task detected

### Outbound Hooks
- Agent responses sent back to Copilot Chat via API
- Maintain conversation context across handoffs
- Support for rich content (code blocks, links)

### Adapter Interface
```javascript
const adapter = init({ endpoint: 'https://api.github.com/copilot/chat', token: process.env.GITHUB_TOKEN });
await sendMessage(adapter, { text: 'Agent response', sessionId: '123' });
const message = await receiveMessage(adapter); // Poll or webhook
```

## Implementation Plan
1. Extend adapter with Copilot Chat API integration
2. Add webhook endpoint to dashboard-server.js
3. Update router to detect Copilot Chat sources
4. Test with mock Copilot Chat API

## Acceptance Tests
- Adapter can send/receive messages
- Baton handoff triggered from Copilot Chat
- Error handling for API failures