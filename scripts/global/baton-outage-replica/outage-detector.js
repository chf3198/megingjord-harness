// outage-detector.js - Detect GitHub outage via injected probe function.
// Even outside of an outage, the replica is always verify-only. The detector
// simply flips the replica into explicit outage mode for observability.
// Refs #3294, Epic #3284. Node built-ins only.
'use strict';

// Default probe timeout before a probe is treated as unreachable.
const PROBE_TIMEOUT_DEFAULT_MS = 5000;

/**
 * Probe GitHub availability using an injected probe function.
 * The probe function should return a promise that resolves to
 * { reachable: boolean } or throws on network failure.
 *
 * DESIGN NOTE: even when isOutage returns false (GitHub is reachable),
 * the replica remains verify-only. The outage detector is an observability
 * signal, not a mode switch that enables writes.
 *
 * @param {Function} probeFn - async () => { reachable: boolean }
 * @param {object} [options]
 * @param {number} [options.timeoutMs] - Probe timeout (default PROBE_TIMEOUT_DEFAULT_MS).
 * @returns {Promise<{outage: boolean, reason: string}>}
 */
async function isOutage(probeFn, options = {}) {
  const timeoutMs = options.timeoutMs || PROBE_TIMEOUT_DEFAULT_MS;
  if (typeof probeFn !== 'function') {
    return { outage: true, reason: 'probe-not-a-function' };
  }
  try {
    const result = await Promise.race([
      probeFn(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('probe-timeout')), timeoutMs);
      }),
    ]);
    if (result && result.reachable === true) {
      return { outage: false, reason: 'probe-reachable' };
    }
    return { outage: true, reason: 'probe-unreachable' };
  } catch (probeError) {
    const reason = probeError.message === 'probe-timeout'
      ? 'probe-timeout'
      : 'probe-error-' + (probeError.message || 'unknown');
    return { outage: true, reason };
  }
}

module.exports = { isOutage };
