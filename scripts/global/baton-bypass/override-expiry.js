// override-expiry.js -- Scheduled-job core: expire stale override labels.
// Refs #3292, Epic #3284 (W4). AC1: auto-expire past-expiry overrides.
'use strict';

const { parseOverride, isExpired } = require('./override-label');

/**
 * Build an expiry incident event for a single override.
 * @param {object} parsed - The parsed override fields.
 * @param {number} issueNumber - The issue the label was on.
 * @param {string} nowIso - Current timestamp.
 * @returns {object} A v3-schema incident event.
 */
function buildExpiryIncident(parsed, issueNumber, nowIso) {
  return {
    version: 3,
    ts: nowIso,
    service: 'baton-bypass',
    env: 'local',
    event: 'override-expired',
    pattern_id: 'override-auto-expire',
    severity: 'low',
    gate: parsed.gate,
    approver: parsed.approver,
    issue: issueNumber,
    expires: parsed.expires,
  };
}

/**
 * Find and remove override labels that have passed their expiry.
 * Pure logic with injected ghClient for GitHub operations.
 * @param {Array<{number:number, labels:string[]}>} issues
 * @param {{removeLabel:function, addComment:function}} ghClient
 * @param {string} nowIso - Current time as ISO8601 (pure; no internal clock).
 * @returns {Array<object>} List of expired override events emitted.
 */
function expireOverrides(issues, ghClient, nowIso) {
  const expiredEvents = [];
  for (const issue of issues) {
    const overrideLabels = (issue.labels || []).filter(
      function filterOverride(label) { return label.startsWith('override:'); }
    );
    for (const label of overrideLabels) {
      const parsed = parseOverride(label);
      if (!parsed.valid) continue;
      if (!isExpired(parsed, nowIso)) continue;
      ghClient.removeLabel(issue.number, label);
      ghClient.addComment(issue.number, 'Override label expired and removed: ' + label);
      expiredEvents.push(buildExpiryIncident(parsed, issue.number, nowIso));
    }
  }
  return expiredEvents;
}

module.exports = { expireOverrides };
