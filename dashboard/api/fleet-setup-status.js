#!/usr/bin/env node
'use strict';
// #3173 — GET /api/fleet/setup/status + /api/fleet/inventory merged view.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveInventory } = require('../../scripts/global/resolve-inventory');
const { getCredential, loadLocalEnvOnce } = require('../../scripts/global/load-local-env');

const CAP = path.join(process.cwd(), '.dashboard', 'capabilities.json');
const OPTIONAL_KEYS = ['OPENROUTER_API_KEY', 'GROQ_API_KEY', 'CEREBRAS_API_KEY', 'GOOGLE_AI_STUDIO_API_KEY', 'ANTHROPIC_API_KEY'];

function probeAgeMs() {
  if (!fs.existsSync(CAP)) return null;
  return Date.now() - fs.statSync(CAP).mtimeMs;
}

function fleetSetupStatus() {
  loadLocalEnvOnce();
  const devices = resolveInventory('devices', { probeEnrich: true });
  const missing = OPTIONAL_KEYS.filter((key) => !getCredential(key));
  const age = probeAgeMs();
  return {
    ok: true,
    overlay: devices._source?.overlay || false,
    deviceCount: (devices.devices || []).length,
    probeAgeMs: age,
    probeStale: age == null || age > 86400000,
    missingOptionalKeys: missing,
    keychain: Boolean(process.env.MEGINGJORD_KEYCHAIN),
  };
}

function fleetInventoryPayload() {
  return {
    ok: true,
    inventory: resolveInventory('devices', { probeEnrich: true }),
    services: resolveInventory('services', { probeEnrich: false }),
  };
}

module.exports = { fleetSetupStatus, fleetInventoryPayload, probeAgeMs, OPTIONAL_KEYS };
