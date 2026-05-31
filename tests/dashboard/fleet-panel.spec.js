const test = require('node:test');
const assert = require('node:assert');
const { renderFleetPanel, renderEntry, elapsedSeconds } =
  require('../../dashboard/js/fleet-panel');

test('renderFleetPanel: empty state when no entries', () => {
  const html = renderFleetPanel({ entries: [] });
  assert.match(html, /No fleet models currently in-flight/);
});

test('renderFleetPanel: error state when payload.error', () => {
  const html = renderFleetPanel({ error: 'network' });
  assert.match(html, /Fleet unreachable: network/);
});

test('renderFleetPanel: renders entry count', () => {
  const html = renderFleetPanel({ entries: [
    { host: '100.91.113.16', model: 'qwen2.5-coder:32b', team: 'claude-code', ticket: 2519, started_at: new Date().toISOString(), eta_s: 600 },
  ]});
  assert.match(html, /in-flight \(1\)/);
});

test('renderEntry: includes host/model/team/ticket', () => {
  const html = renderEntry({ host: 'h', model: 'm', team: 't', ticket: 1, started_at: new Date().toISOString(), eta_s: 60 });
  assert.match(html, /agent-t/);
  assert.match(html, /#1/);
  assert.match(html, /60s ETA/);
});

test('elapsedSeconds: returns positive integer', () => {
  const past = new Date(Date.now() - 5000).toISOString();
  assert.ok(elapsedSeconds(past) >= 5);
});
