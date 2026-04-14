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
    'baton:': 'baton', 'ticket:': 'system',
    'git:': 'system', 'test:': 'test'
  };
  const prefix = Object.keys(map).find(k => e.type.startsWith(k));
  const type = prefix ? map[prefix] : 'info';
  const msg = e.agent
    ? `[${e.agent}] ${e.detail || e.type}`
    : (e.detail || e.type);
  return { type, message: msg, detail: e.issue ? `#${e.issue}` : '' };
}

function batonFromEvents(events) {
  const last = [...events].reverse().find(e => e.role);
  if (!last) return null;
  return {
    activeRole: last.role || 'idle',
    issue: last.issue || null,
    status: 'in-progress',
    agent: last.agent || ''
  };
}

async function pollEventBus(activityLog) {
  const events = await fetchEvents(_lastEventTs);
  if (!events.length) return null;
  _lastEventTs = events[events.length - 1].ts;
  for (const e of events) {
    const a = eventToActivity(e);
    addActivity(activityLog, a.type, a.message, a.detail);
  }
  return batonFromEvents(events);
}
