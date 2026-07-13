#!/usr/bin/env node
'use strict';
// tier: 1
// dark-not-flipped-inventory.js (#3795, Epic #3789 §3.3) — standing G8 gauge over lane-created
// dark-launch flags that were MERGED-DARK but never flipped (state dark|canary). A flag that
// merges disabled and is then forgotten is a silent gap in the verify-then-flip lane: the code
// shipped but the verification/flip never happened. This gauge makes that inventory visible.
const fs = require('node:fs');
const path = require('node:path');
const { emitV3 } = require('./event-schema-v3');
const { loadRegistry } = require('./megalint/flag-lifecycle-lint');

const REPO_ROOT = path.join(__dirname, '..', '..');
const EVENTS_FILE = path.join(REPO_ROOT, 'dashboard', 'events.jsonl');

/** Compute the dark-not-flipped inventory from the lifecycle registry. */
function inventory(registry = loadRegistry()) {
  const pending = Object.entries(registry.flags || {})
    .filter(([, rec]) => rec.state === 'dark' || rec.state === 'canary')
    .map(([flag, rec]) => ({ flag, state: rec.state, created_ticket: rec.created?.ticket, owner_ticket: rec.owner_ticket }));
  return { count: pending.length, flags: pending };
}

/** Emit the inventory as a v3 G8 gauge event and return it. */
function emitGauge(file = EVENTS_FILE, registry) {
  const inv = inventory(registry);
  const event = {
    ts: new Date().toISOString(),
    version: 3,
    service: 'dark-not-flipped-inventory',
    env: process.env.MEGINGJORD_ENV || 'local',
    event: 'gauge:dark-not-flipped-inventory',
    team: process.env.HAMR_TEAM || 'claude-code',
    trigger_role: 'system',
    gauge_value: inv.count,
    flags: inv.flags,
    _summary: `${inv.count} lane flag(s) merged-dark but not flipped`,
  };
  emitV3(event, file);
  return event;
}

module.exports = { inventory, emitGauge, EVENTS_FILE };

if (require.main === module) {
  const ev = emitGauge();
  process.stdout.write(`${JSON.stringify(ev)}\n`);
  if (!fs.existsSync(EVENTS_FILE)) process.exit(1);
}
