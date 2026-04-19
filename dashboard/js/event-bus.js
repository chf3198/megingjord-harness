// Event Bus Client — polls /api/events for live dashboard updates
// _batonTickets: active baton only (backlog→consultant, never closed)
// _ticketLog: full audit trail of all tickets, all statuses

let _lastEventTs = null;
const _batonTickets = {};   // issue → ticket (active baton only)
const _batonHistory = {};   // issue → [{role, ts}] for timeline
const _ticketLog = {};      // issue → ticket (all, including closed)
const CLOSED_STATUSES = new Set(['done', 'cancelled']);
const STATUS_ROLE_MAP = {
  backlog: null, todo: 'manager', 'in-progress': 'collaborator',
  'ready-for-testing': 'admin', testing: 'admin',
  'passed-testing': 'admin', done: 'consultant', cancelled: null,
};

async function fetchEvents(since) {
  const url = since
    ? '/api/events?since=' + encodeURIComponent(since)
    : '/api/events';
  try { const r = await fetch(url); return r.ok ? await r.json() : []; }
  catch (e) { console.warn('event-bus: poll failed:', e.message); return []; }
}

function eventToActivity(e) {
  const map = {
    'baton:': 'baton', 'ticket:created': 'ticket',
    'ticket:status': 'ticket', 'ticket:role': 'role',
    'git:branch': 'branch', 'git:pr': 'pr',
    'git:commit': 'commit', 'git:merge': 'merge',
    'deploy:': 'deploy', 'test:': 'test'
  };
  const key = Object.keys(map).find(k => e.type.startsWith(k));
  const type = key ? map[key] : 'system';
  const msg = e.agent
    ? `[${e.agent}] ${e.detail || e.type}`
    : (e.detail || e.type);
  return { type, message: msg, detail: e.issue ? `#${e.issue}` : '' };
}

/** Merge events into persistent baton ticket map and ticket log */
function mergeBatonEvents(events) {
  const now = Date.now();
  for (const e of events) {
    if (!e.issue) continue;
    const prev = _batonTickets[e.issue] || _ticketLog[e.issue];
    const base = { issue: e.issue, _updated: now,
      title: e.title || prev?.title || '',
      epic: e.epic || prev?.epic || null,
      agent: e.agent || prev?.agent || '',
      model: e.model || prev?.model || '' };
    // Always update ticket log (full audit trail)
    const logStatus = e.status || (e.type === 'ticket:created' ? 'backlog' : null)
      || _ticketLog[e.issue]?.status || 'backlog';
    _ticketLog[e.issue] = { ...base, status: logStatus,
      activeRole: e.role || _ticketLog[e.issue]?.activeRole || null };
    // Baton map: evict on close; skip if no role
    if (e.status && CLOSED_STATUSES.has(e.status)) { delete _batonTickets[e.issue]; continue; }
    if (!e.role) continue;
    _batonTickets[e.issue] = { ...base, activeRole: e.role, status: e.status || 'in-progress' };
    if (!_batonHistory[e.issue]) _batonHistory[e.issue] = [];
    _batonHistory[e.issue].push({ role: e.role, ts: e.ts || new Date(now).toISOString() });
  }
  // Sort baton: by issue# desc (all active, no done tier)
  return Object.values(_batonTickets).sort((a, b) => (b.issue || 0) - (a.issue || 0));
}

const _STALE_MS = 30 * 60 * 1000;
function pruneClosedFromGitHub(issues) {
  (issues||[]).filter(i=>i.state==='closed').forEach(i=>delete _batonTickets[String(i.number)]);
}
function getBatonState() {
  const now = Date.now();
  return Object.values(_batonTickets).map(t=>({...t,stale:now-t._updated>_STALE_MS}));
}
function getTicketLog() {
  return Object.values(_ticketLog).sort((a, b) => (b.issue || 0) - (a.issue || 0));
}
function getTicketTimeline(issue) { return _batonHistory[issue] || []; }

/** Detect governance gaps: skipped baton roles */
function detectMissingEvents(issue) {
  const exp = ['manager','collaborator','admin','consultant'];
  const roles = (_batonHistory[issue]||[]).map(h=>h.role);
  return roles.flatMap((r,i) => i>=roles.length-1 ? [] :
    exp.slice(exp.indexOf(r)+1, exp.indexOf(roles[i+1])));
}

async function pollEventBus(activityLog) {
  const events = await fetchEvents(_lastEventTs);
  if (!events.length) return getBatonState();
  _lastEventTs = events[events.length - 1].ts;
  for (const e of events) {
    const a = eventToActivity(e);
    addActivity(activityLog, a.type, a.message, a.detail);
    if (e.agent && e.model) addRouterLogEntry(e.agent, e.model, e.detail || e.type);
  }
  return mergeBatonEvents(events);
}
