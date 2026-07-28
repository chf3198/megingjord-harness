'use strict';
// override-resolver (Epic #2892 P1-b) — resolve a repo-local .megingjord/overrides
// file, apply the P1-a hard-floor (Tier-H rejected), enumerate active overrides,
// and emit a redacted G8 `override-applied` event per active (Tier-A/C) override.
const path = require('path');
const contract = require('./megalint/override-contract');
const { emitV3 } = require('./event-schema-v3');
const { redactEvent } = require('./log-redaction');

const EVENTS_FILE = path.join(__dirname, '..', '..', 'dashboard', 'events.jsonl');

/** Resolve declared overrides: {effective (Tier-A/C), rejected (Tier-H violations), active (keys)}. */
function resolve(cwd = process.cwd()) {
  const declared = contract.loadRepoOverrides(cwd);
  const { violations } = contract.checkOverrides(declared);
  const rejectedKeys = new Set(violations.map((viol) => viol.key));
  const effective = {};
  for (const [key, value] of Object.entries(declared)) {
    if (!rejectedKeys.has(key)) effective[key] = value;
  }
  return { effective, rejected: violations, active: Object.keys(effective) };
}

/** Enumerate a repo's active (effective, non-hard-floor) override keys — for G8 / census. */
function activeOverrides(cwd = process.cwd()) {
  return resolve(cwd).active;
}

/** Build a schema-v3 override-applied event for one active override. */
function buildEvent(key, value) {
  return {
    ts: new Date().toISOString(), version: 3, service: 'override-resolver',
    env: process.env.MEGINGJORD_ENV || 'local', event: 'override-applied',
    override_key: key, override_value: String(value),
  };
}

/** Emit a redacted override-applied event per active override (G8 audit). Returns the events. */
function auditOverrides(cwd = process.cwd(), opts = {}) {
  const { effective } = resolve(cwd);
  const events = Object.entries(effective).map(([key, value]) => redactEvent(buildEvent(key, value)).event);
  if (!opts.dryRun) {
    for (const eventObj of events) emitV3(eventObj, opts.file || EVENTS_FILE);
  }
  return events;
}

module.exports = { resolve, activeOverrides, auditOverrides, buildEvent };
