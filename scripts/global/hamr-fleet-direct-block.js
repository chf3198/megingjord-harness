'use strict';
// hamr-fleet-direct-block — env-gated enforcement that fails direct fleet curls
// when MEGINGJORD_FLEET_DIRECT_BLOCK=1. Wraps detectBypass (#2220 P1-2).
// Refs Epic #2029 #2219.

const ENV_FLAG = 'MEGINGJORD_FLEET_DIRECT_BLOCK';
const REDIRECT_MSG = 'Direct fleet call blocked. Use scripts/global/fleet-red-team-dispatch.js (Epic #2041 #2175) for HAMR-routed dispatch via tier=fleet-local.';

function isEnabled(env) {
  return (env || process.env)[ENV_FLAG] === '1';
}

function shouldBlock({ detection, env }) {
  if (!isEnabled(env)) return { block: false, reason: 'env-flag-off' };
  if (!detection || !detection.detected) return { block: false, reason: 'no-bypass-detected' };
  if (detection.suppressed) return { block: false, reason: 'override-marker-suppresses' };
  if (detection.severity === 'fleet-bypass') return { block: true, reason: 'fleet-direct-blocked', message: REDIRECT_MSG };
  if (detection.severity === 'paid-bypass') return { block: false, reason: 'paid-bypass-not-fleet-scope' };
  return { block: false, reason: 'unknown-severity' };
}

function blockMessage(detection) {
  const providers = (detection && detection.providers) ? detection.providers.map(function (p) { return p.name; }).join(', ') : 'unknown';
  return `${REDIRECT_MSG} (detected providers: ${providers})`;
}

module.exports = { shouldBlock, isEnabled, blockMessage, ENV_FLAG, REDIRECT_MSG };
