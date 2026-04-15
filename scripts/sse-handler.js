// scripts/sse-handler.js — Server-Sent Events for dashboard live push
// Watches .dashboard/events.jsonl and streams new events to connected clients

const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.resolve(__dirname, '..', '.dashboard', 'events.jsonl');
const clients = new Set();

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

/** Parse last N lines from events.jsonl */
function tailLines(content, n) {
  const lines = content.trim().split('\n').slice(-n);
  const events = [];
  for (const line of lines) {
    try { events.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return events;
}

// Watch events.jsonl for new entries
let lastSize = 0;
function initWatcher() {
  if (!fs.existsSync(EVENTS_FILE)) return;
  lastSize = fs.statSync(EVENTS_FILE).size;
  fs.watch(EVENTS_FILE, { persistent: false }, () => {
    try {
      const stat = fs.statSync(EVENTS_FILE);
      if (stat.size <= lastSize) { lastSize = stat.size; return; }
      const buf = Buffer.alloc(stat.size - lastSize);
      const fd = fs.openSync(EVENTS_FILE, 'r');
      fs.readSync(fd, buf, 0, buf.length, lastSize);
      fs.closeSync(fd);
      lastSize = stat.size;
      const newLines = buf.toString('utf-8').trim().split('\n');
      for (const line of newLines) {
        try {
          const ev = JSON.parse(line);
          broadcast(ev.type || 'activity', ev);
        } catch { /* skip malformed */ }
      }
    } catch { /* file race */ }
  });
}

try { initWatcher(); } catch { /* no events file yet */ }

module.exports = { stream, broadcast, clients };
