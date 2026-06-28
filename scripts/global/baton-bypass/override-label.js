// override-label.js -- Parse + validate structured override labels/comments.
// Form: override:<gate>; reason:<...>; approver:<alias>; expires:<ISO8601>
// Refs #3292, Epic #3284 (W4). AC1: overrides carry reason/approver/expires.
'use strict';

const FIELD_NAMES = ['gate', 'reason', 'approver', 'expires'];

const OVERRIDE_RE =
  /override\s*:\s*(?<gate>[^;]*);\s*reason\s*:\s*(?<reason>[^;]*);\s*approver\s*:\s*(?<approver>[^;]*);\s*expires\s*:\s*(?<expires>[^;]*)/i;

/**
 * Parse an override label/comment string into structured fields.
 * @param {string} text - The override text to parse.
 * @returns {{gate, reason, approver, expires, valid, errors}}
 */
function parseOverride(text) {
  const errors = [];
  if (typeof text !== 'string' || !text.trim()) {
    return { gate: null, reason: null, approver: null, expires: null, valid: false, errors: ['empty input'] };
  }
  const match = text.match(OVERRIDE_RE);
  if (!match || !match.groups) {
    return { gate: null, reason: null, approver: null, expires: null, valid: false, errors: ['format mismatch'] };
  }
  const result = {};
  for (const fieldName of FIELD_NAMES) {
    result[fieldName] = (match.groups[fieldName] || '').trim() || null;
  }
  for (const fieldName of FIELD_NAMES) {
    if (!result[fieldName]) errors.push('missing field: ' + fieldName);
  }
  if (result.expires && Number.isNaN(Date.parse(result.expires))) {
    errors.push('expires is not valid ISO8601');
  }
  result.valid = errors.length === 0;
  result.errors = errors;
  return result;
}

/**
 * Check whether an override has expired. Pure: clock passed in.
 * @param {{expires:string}} override - Parsed override with expires field.
 * @param {string} nowIso - Current time as ISO8601 string.
 * @returns {boolean} True if the override is past its expiry.
 */
function isExpired(override, nowIso) {
  if (!override || !override.expires) return true;
  const expireTime = Date.parse(override.expires);
  const currentTime = Date.parse(nowIso);
  if (Number.isNaN(expireTime) || Number.isNaN(currentTime)) return true;
  return currentTime > expireTime;
}

/**
 * Log an override event to incidents.jsonl via an injected writer.
 * Redacts the override through log-redaction before writing.
 * @param {object} override - The parsed override object.
 * @param {function} writer - Injected write function (receives redacted event).
 * @returns {object} The event that was written.
 */
function logOverride(override, writer) {
  let redactEventFn = null;
  try {
    const logRedaction = require('../log-redaction');
    if (typeof logRedaction.redactEvent === 'function') {
      redactEventFn = logRedaction.redactEvent;
    }
  } catch {
    // log-redaction unavailable; no-op fallback
  }
  const event = {
    version: 3,
    ts: new Date().toISOString(),
    service: 'baton-bypass',
    env: 'local',
    event: 'override-recorded',
    gate: override.gate,
    reason: override.reason,
    approver: override.approver,
    expires: override.expires,
  };
  const redacted = redactEventFn ? redactEventFn(event).event : event;
  writer(redacted);
  return redacted;
}

module.exports = { parseOverride, isExpired, logOverride, OVERRIDE_RE, FIELD_NAMES };
