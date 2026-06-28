// role-drift-janitor.js — Strip execution role labels from terminal/closed issues.
// Pure logic; IO injected via githubClient + incidentWriter. Refs #3291, Epic #3284.
'use strict';

const EXECUTION_ROLES = Object.freeze([
  'role:manager',
  'role:collaborator',
  'role:admin',
  'role:consultant',
]);

/**
 * Identify execution role labels on an issue.
 * @param {string[]} labels - Label names on the issue.
 * @returns {string[]} Execution role labels found.
 */
function findExecutionRoles(labels) {
  return labels.filter((label) => EXECUTION_ROLES.includes(label));
}

/**
 * Determine if an issue is in a terminal state (closed).
 * @param {{state: string}} issue
 * @returns {boolean}
 */
function isTerminalIssue(issue) {
  return issue.state === 'closed' || issue.state === 'CLOSED';
}

/** Emit a drift incident for a stale role label on a terminal issue. */
function emitDriftIncident(incidentWriter, issueNumber, roleLabel, dryRun) {
  if (!incidentWriter) return;
  incidentWriter.append({
    ts: new Date().toISOString(),
    version: 3,
    service: 'baton-fsm-reconciler',
    env: 'local',
    event: 'role-drift-stripped',
    pattern_id: 'terminal-issue-carries-role-label',
    issue: issueNumber,
    role_label: roleLabel,
    dry_run: dryRun,
    severity: 'low',
  });
}

/** Process one stale role label on a single issue. */
async function processStaleRole(issue, roleLabel, githubClient, incidentWriter, dryRun) {
  const finding = { issue: issue.number, strippedRole: roleLabel, applied: false };
  if (!dryRun) {
    await githubClient.removeLabel(issue.number, roleLabel);
    finding.applied = true;
  }
  emitDriftIncident(incidentWriter, issue.number, roleLabel, dryRun);
  return finding;
}

/**
 * Sweep terminal issues for stale execution role labels.
 * @param {Array<{number: number, state: string, labels: string[]}>} issues
 * @param {object} githubClient - {removeLabel, ...}
 * @param {object} incidentWriter - {append(event)}
 * @param {{dryRun?: boolean}} options - Default dryRun=true (report only).
 * @returns {Promise<Array<{issue: number, strippedRole: string, applied: boolean}>>}
 */
async function sweepTerminalRoles(issues, githubClient, incidentWriter, options = {}) {
  const dryRun = options.dryRun !== false;
  const findings = [];
  for (const issue of issues) {
    if (!isTerminalIssue(issue)) continue;
    const staleRoles = findExecutionRoles(issue.labels);
    for (const roleLabel of staleRoles) {
      const finding = await processStaleRole(issue, roleLabel, githubClient, incidentWriter, dryRun);
      findings.push(finding);
    }
  }
  return findings;
}

module.exports = {
  sweepTerminalRoles,
  findExecutionRoles,
  isTerminalIssue,
  EXECUTION_ROLES,
};
