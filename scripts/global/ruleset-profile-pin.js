'use strict';
// Ruleset profile pinning (Epic #3576 W-G, E6). Freezes the validation profile at
// MANAGER_HANDOFF: a blocking rule that lands AFTER a ticket's pinned ruleset version
// does not retroactively invalidate that ticket's in-flight artifacts (#3532 class).
// Security-critical rules (the #2892 Tier-H hard-floor) are immediate-effect (G4) and
// always apply. Opt-in uplift lets a low-risk in-flight ticket adopt newer rules.
const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '..', '..', 'config', 'ruleset-version.json');
const HARD_FLOOR_FILE = path.join(__dirname, '..', '..', 'config', 'override-hard-floor.json');
const PIN_RE = /ruleset_version\s*:\s*([0-9]+)/i;
const UPLIFT_RE = /ruleset_uplift\s*:\s*(?:opt-in|true|yes)/i;

function currentRulesetVersion() {
  try { return Number(JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')).version) || 1; }
  catch { return 1; }
}

function hardFloorRules() {
  try { return new Set(JSON.parse(fs.readFileSync(HARD_FLOOR_FILE, 'utf8')).hard_floor || []); }
  catch { return new Set(); }
}

function isSecurityCritical(ruleName, floor) {
  return (floor || hardFloorRules()).has(ruleName);
}

// Pin recorded at MANAGER_HANDOFF; absent -> fall back to the current version (legacy, advisory).
function resolvePin(managerBody, opts = {}) {
  const body = String(managerBody || '');
  const matched = PIN_RE.exec(body);
  const fallback = opts.fallbackVersion != null ? Number(opts.fallbackVersion) : currentRulesetVersion();
  return { version: matched ? Number(matched[1]) : fallback,
    optInUplift: UPLIFT_RE.test(body), pinned: Boolean(matched) };
}

// A rule applies to a pinned ticket iff: security-critical (immediate-effect), OR it
// landed at/before the pin, OR the ticket opted into uplift.
function ruleApplies(rule, pin) {
  if (!rule) return true;
  if (rule.securityCritical || isSecurityCritical(rule.name)) return true;
  if (pin && pin.optInUplift) return true;
  const since = Number(rule.since) || 1;
  return since <= (pin && pin.version != null ? pin.version : currentRulesetVersion());
}

module.exports = { currentRulesetVersion, hardFloorRules, isSecurityCritical, resolvePin, ruleApplies, VERSION_FILE };
