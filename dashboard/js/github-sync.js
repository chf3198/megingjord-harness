// GitHub Sync — reconcile baton/ticket state with GitHub API
// Called during refreshAll() to feed batonState from live GitHub data
/* global getTicketLog */

(function() {
const ACTIVE_STATUSES = new Set([
  'triage', 'ready', 'in-progress', 'testing', 'review'
]);
const TERMINAL_STATUSES = new Set([
  'done', 'cancelled', 'backlog', 'blocked', 'dormant', 'deferred', 'queued'
]);
const STALE_MS = 30 * 60 * 1000;

function ghStatusFromLabels(labels) {
  const map = {
    'status:triage': 'triage', 'status:ready': 'ready',
    'status:in-progress': 'in-progress', 'status:testing': 'testing',
    'status:review': 'review', 'status:done': 'done',
    'status:backlog': 'backlog', 'status:blocked': 'blocked',
    'status:cancelled': 'cancelled', 'status:queued': 'queued',
    'status:dormant': 'dormant', 'status:deferred': 'deferred',
  };
  for (const l of (labels || [])) { if (map[l]) return map[l]; }
  return null;
}
const ROLE_ORDER = ['manager', 'collaborator', 'admin', 'consultant'];
const ROLE_MAP = { 'role:manager': 0, 'role:collaborator': 1, 'role:admin': 2, 'role:consultant': 3 };
function ghRoleFromLabels(labels) {
  let best = -1;
  for (const l of (labels || [])) { if (ROLE_MAP[l] !== undefined && ROLE_MAP[l] > best) best = ROLE_MAP[l]; }
  return best >= 0 ? ROLE_ORDER[best] : null;
}
function isEpicFromLabels(labels) {
  return (labels || []).some(l => l === 'type:epic');
}

function inferRole(status) {
  const map = {
    'triage': 'manager', 'in-progress': 'collaborator',
    'testing': 'admin', 'review': 'consultant',
  };
  return map[status] || null;
}

function buildLogMap() {
  const log = typeof getTicketLog === 'function' ? getTicketLog() : [];
  const map = {};
  log.forEach(t => { map[String(t.issue)] = t; });
  return map;
}

/** Sync ticket log and baton state with authoritative GitHub data. */
function syncWithGitHub(ghIssues) {
  if (!ghIssues || !ghIssues.length) return [];
  const logMap = buildLogMap();
  const synced = [];
  for (const gh of ghIssues) {
    const key = String(gh.number);
    const existing = logMap[key] || {};
    const ghStatus = gh.state === 'closed' ? 'done'
      : ghStatusFromLabels(gh.labels);
    const ghRole = ghRoleFromLabels(gh.labels);
    const resolvedStatus = ghStatus || existing.status || 'backlog';
    const resolvedRole = ghRole || inferRole(resolvedStatus) || null;
    synced.push({
      issue: gh.number,
      title: gh.title || existing.title || '',
      status: resolvedStatus,
      activeRole: resolvedRole,
      agent: existing.agent || gh.assignee || '',
      model: existing.model || '',
      epic: gh.epic || existing.epic || null,
      isEpic: isEpicFromLabels(gh.labels),
      labels: gh.labels || [],
      lastComment: gh.lastComment || existing.lastComment || null,
      closed: gh.state === 'closed',
      _updated: Date.now(),
    });
  }
  return synced.sort((a, b) => (b.issue || 0) - (a.issue || 0));
}

/** Extract active baton tickets from synced data (active statuses + open). */
function extractActiveBaton(synced) {
  const now = Date.now();
  return synced
    .filter(t => ACTIVE_STATUSES.has(t.status) && !t.closed)
    .map(t => ({ ...t, stale: now - t._updated > STALE_MS }));
}

if (typeof module !== 'undefined') {
  module.exports = { syncWithGitHub, extractActiveBaton, inferRole,
    ACTIVE_STATUSES, TERMINAL_STATUSES };
} else {
  Object.assign(window, { syncWithGitHub, extractActiveBaton, inferRole });
}
})();
