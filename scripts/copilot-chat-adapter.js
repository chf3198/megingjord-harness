#!/usr/bin/env node
// Copilot Chat Adapter skeleton — ticket 98
// Purpose: provide an adapter interface for Copilot Chat hooks (inbound/outbound)

function init(config) {
  // config: { endpoint, token }
  return { config };
}

async function sendMessage(adapter, message) {
  // Placeholder: integrate with Copilot Chat API or local runtime
  console.log('copilot-chat-adapter: sendMessage', message && message.slice ? message.slice(0,80) : message);
  return { ok: true, id: 'stub-1' };
}

async function receiveMessage(adapter) {
  // Placeholder for webhook receiver
  return { from: 'user', text: 'stub reply' };
}

module.exports = { init, sendMessage, receiveMessage };
