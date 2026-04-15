// Event Bus Client — polls /api/events for live dashboard updates
// Persistent baton map so tickets stay visible through full workflow

let _lastEventTs = null;
const _batonTickets = {};   // issue → ticket, persists across polls
const _batonHistory = {};   // issue → [{role, ts}] for timeline
const BATON_TTL_MS = 90000; // keep tickets visible 90s after last update

async function fetchEvents(since) {
  const url = since
    ? '/api/events?since=' + encodeURIComponent(since)
    : '/api/events';
  try { const r = await fetch(url); return r.ok ? await r.json() : []; }
  catch { return []; }
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

/** Merge events into persistent baton ticket map */
function mergeBatonEvents(events) {
  const now = Date.now();
  for (const e of events) {
    if (!e.role || !e.issue) continue;
    const prev = _batonTickets[e.issue];
    _batonTickets[e.issue] = {
      activeRole: e.role, issue: e.issue,
      title: e.title || prev?.title || '',
      epic: e.epic || prev?.epic || null,
      status: e.status || 'in-progress',
      agent: e.agent || '', model: e.model || prev?.model || '',
      _updated: now
    };
    if (!_batonHistory[e.issue]) _batonHistory[e.issue] = [];
    _batonHistory[e.issue].push({ role: e.role, ts: e.ts || new Date(now).toISOString() });
  }
  // Expire stale done tickets beyond TTL
  for (const [id, t] of Object.entries(_batonTickets)) {
    if (t.status === 'done' && now - t._updated > BATON_TTL_MS) delete _batonTickets[id];
  }
  return Object.values(_batonTickets);
}

function getBatonState() { return Object.values(_batonTickets); }
function getTicketTimeline(issue) { return _batonHistory[issue] || []; }

/** Detect governance gaps: skipped baton roles */
function detectMissingEvents(issue) {
  const expected = ['manager', 'collaborator', 'admin', 'consultant'];
  const hist = _batonHistory[issue] || [];
  const roles = hist.map(h => h.role);
  const gaps = [];
  for (let i = 0; i < roles.length - 1; i++) {
    const from = expected.indexOf(roles[i]);
    const to = expected.indexOf(roles[i + 1]);
    if (to > from + 1) {
      for (let j = from + 1; j < to; j++) gaps.push(expected[j]);
    }
  }
  return gaps;
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
