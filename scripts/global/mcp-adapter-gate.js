#!/usr/bin/env node
'use strict';
// tier: 1
// mcp-adapter-gate.js (#3793, Epic #3789) — narrow, default-OFF opt-in gate for the
// HAMR MCP adapter. Reads MEGINGJORD_MCP_ADAPTER_ENABLED === '1'; absence = OFF =
// fail-closed (the adapter simply does not run — no degraded-but-live state).
//
// Audit C-8 (Phase-0 §3.2, research/security-surface-verify-then-flip-lane-2026-07-13.md):
// dark-merging the adapter must NOT reuse the global MEGINGJORD_HAMR_DISABLED kill-switch,
// which would collaterally disable ALL HAMR Tier-2 subsystems (mailbox, cron, cache push,
// governance bundle, substrate health). This flag is orthogonal to that kill-switch.
//
// This module is the single source of truth for the gate semantics. The #3050 adapter
// (scripts/global/hamr-mcp-adapter.js) wires its startup to mcpAdapterEnabled() when PR
// #3050 lands dark on #3796; the gate ships + is unit-tested here on main independently.

const FLAG = 'MEGINGJORD_MCP_ADAPTER_ENABLED';

/**
 * Whether the MCP adapter opt-in flag is explicitly enabled.
 * @returns {boolean} true only when the flag is exactly '1'; absence or any other
 *   value = OFF (fail-closed). Read at call time so tests can toggle mid-run.
 */
function isEnabled() {
  return process.env[FLAG] === '1';
}

/**
 * Emit a non-silent advisory when the adapter is consulted while OFF (G8 observability;
 * the OFF state must never be silent). Suppressed under MEGINGJORD_QUIET_RESOLVER=1 for
 * CI/cron parity with the role-resolver's quiet mode. No-op when the flag is enabled.
 * @param {{stream?: {write: Function}}} [opts] - optional sink; defaults to process.stderr.
 * @returns {string|null} the advisory line written, or null when enabled/suppressed.
 */
function emitOffAdvisory(opts = {}) {
  if (isEnabled()) return null;
  if (process.env.MEGINGJORD_QUIET_RESOLVER === '1') return null;
  const line = `[mcp-adapter-gate] OFF: ${FLAG} not set to '1'; MCP adapter is fail-closed ` +
    `(dark). Set ${FLAG}=1 to enable. Orthogonal to MEGINGJORD_HAMR_DISABLED.\n`;
  const stream = opts.stream || process.stderr;
  stream.write(line);
  return line;
}

/**
 * Resolve the adapter gate. Returns the enabled state and, as a non-silent side effect,
 * emits the OFF advisory (unless suppressed or disabled via opts). The adapter calls this
 * once at startup and refuses to serve when `enabled` is false.
 * @param {{emitAdvisory?: boolean, stream?: {write: Function}}} [opts]
 * @returns {{enabled: boolean, flag: string, advisory: (string|null)}}
 */
function mcpAdapterEnabled(opts = {}) {
  const enabled = isEnabled();
  const shouldEmit = opts.emitAdvisory !== false;
  const advisory = shouldEmit ? emitOffAdvisory(opts) : null;
  return { enabled, flag: FLAG, advisory };
}

module.exports = { mcpAdapterEnabled, isEnabled, emitOffAdvisory, FLAG };
