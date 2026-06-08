'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bridge = require(path.resolve(__dirname, '..', 'scripts', 'global', 'gate-failure-tier1.js'));

function tmpIncidents() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tier1-')), 'incidents.jsonl');
}

test('buildTier1Event emits a schema-v3 operator-caused-gate-failure event', () => {
  const event = bridge.buildTier1Event({ gate: 'merge-bypass-gates', ticket: 2706, ts: '2026-06-07T00:00:00Z' });
  assert.strictEqual(event.version, 3);
  assert.strictEqual(event.event, 'governance.gate-failure-operator-caused');
  assert.strictEqual(event.ticket, 2706);
  assert.match(event.pattern_id, /merge-bypass-gates/);
});

test('appendTier1Incident writes the event as a JSONL line', () => {
  const incidentsPath = tmpIncidents();
  const event = bridge.buildTier1Event({ gate: 'g', ts: '2026-06-07T00:00:00Z' });
  bridge.emitGateFailure({ gate: 'g', ts: '2026-06-07T00:00:00Z', incidentsPath });
  const lines = fs.readFileSync(incidentsPath, 'utf8').split('\n').filter(Boolean);
  assert.strictEqual(lines.length, 1);
  assert.strictEqual(JSON.parse(lines[0]).pattern_id, event.pattern_id);
});

test('the bridge auto-emits so escalation does not depend on operator memory (#2703 fix)', () => {
  const incidentsPath = tmpIncidents();
  bridge.emitGateFailure({ gate: 'quality-required', ticket: 1, incidentsPath });
  const entry = JSON.parse(fs.readFileSync(incidentsPath, 'utf8').trim());
  assert.strictEqual(entry.severity, 'medium');
  assert.strictEqual(entry.service, 'gate-failure-tier1-bridge');
});
