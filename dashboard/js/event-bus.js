// Event Bus Client — polls /api/events for live dashboard updates
// Converts JSONL events into activity log entries and baton state

let _lastEventTs = null;

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

function batonFromEvents(events) {
  const tickets = {};
  for (const e of events) {
    if (!e.role || !e.issue) continue;
    tickets[e.issue] = {
      activeRole: e.role,
      issue: e.issue,
      title: e.title || tickets[e.issue]?.title || '',
      epic: e.epic || tickets[e.issue]?.epic || null,
      status: e.status || 'in-progress',
      agent: e.agent || ''
    };
  }
  const arr = Object.values(tickets);
  return arr.length ? arr : null;
}

async function pollEventBus(activityLog) {
  const events = await fetchEvents(_lastEventTs);
  if (!events.length) return null;
  _lastEventTs = events[events.length - 1].ts;
  for (const e of events) {
    const a = eventToActivity(e);
    addActivity(activityLog, a.type, a.message, a.detail);
    if (e.agent && e.model) {
      addRouterLogEntry(e.agent, e.model, e.detail || e.type);
    }
  }
  return batonFromEvents(events);
}
