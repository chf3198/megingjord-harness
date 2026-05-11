// scripts/sse-handler.js — Server-Sent Events for dashboard live push.
// Multi-surface (events.jsonl, incidents.jsonl, cache-stats.jsonl) via the
// shared scripts/global/jsonl-tail.js (Epic #1339 / #1354).

const fs = require('fs');
const path = require('path');
const { tail } = require('./global/jsonl-tail.js');

const HOME = process.env.HOME || '/tmp';
const EVENTS_FILE = path.resolve(__dirname, '..', '.dashboard', 'events.jsonl');
const INCIDENTS_FILE = path.join(HOME, '.megingjord', 'incidents.jsonl');
const CACHE_STATS_FILE = path.join(HOME, '.megingjord', 'cache-stats.jsonl');

const clients = new Set();
const activeTails = [];

/** SSE endpoint handler for /api/events/stream */
function stream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write('event: connected\ndata: {"ok":true}\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
}

/** Broadcast an SSE event to all connected clients */
function broadcast(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try { client.write(payload); } catch { clients.delete(client); }
  }
}

/** Parse last N lines from a jsonl file (utility for snapshot endpoints) */
function tailLines(content, n) {
  const lines = content.trim().split('\n').slice(-n);
  const events = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return events;
}

/**
 * Subscribe a jsonl surface to live SSE broadcast.
 * Returns a tail handle so callers can close() on shutdown.
 */
function subscribeSurface(file, defaultEventType, opts = {}) {
  if (!fs.existsSync(file)) {
    // File may not exist yet; jsonl-tail handles eventual create via chokidar
  }
  const handle = tail(file, (event) => {
    const eventType = event.event || event.type || defaultEventType;
    broadcast(eventType, event);
  }, { onDrop: (n) => broadcast('dropped', { count: n, file }), ...opts });
  activeTails.push(handle);
  return handle;
}

/** Initialize default subscriptions: events.jsonl, incidents.jsonl, cache-stats.jsonl */
function initWatchers() {
  try { subscribeSurface(EVENTS_FILE, 'activity'); } catch { /* skip */ }
  try { subscribeSurface(INCIDENTS_FILE, 'incident'); } catch { /* skip */ }
  try { subscribeSurface(CACHE_STATS_FILE, 'cache-stat'); } catch { /* skip */ }
}

/** Close all active tails (for tests + shutdown) */
function closeAllSubscriptions() {
  while (activeTails.length > 0) activeTails.pop().close();
}

try { initWatchers(); } catch { /* no surfaces yet — chokidar will pick up when created */ }

module.exports = {
  stream, broadcast, clients, tailLines,
  subscribeSurface, closeAllSubscriptions,
  EVENTS_FILE, INCIDENTS_FILE, CACHE_STATS_FILE,
};
