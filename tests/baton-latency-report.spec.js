'use strict';
// tests/baton-latency-report.spec.js — tdd-pyramid coverage for #2063.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  readEvents, groupByIssue, transitions, summarize, percentile, generate,
} = require('../scripts/global/baton-latency-report');

function tmpFile(content) {
  const p = path.join(os.tmpdir(), `bl-2063-${Date.now()}-${Math.random()}.jsonl`);
  fs.writeFileSync(p, content);
  return p;
}

test('readEvents skips non-baton types', () => {
  const p = tmpFile([
    JSON.stringify({ ts: '2026-05-01T00:00:00Z', type: 'ticket:status', issue: 1, role: 'manager' }),
    JSON.stringify({ ts: '2026-05-01T00:01:00Z', type: 'baton:manager', issue: 1, role: 'manager' }),
  ].join('\n'));
  const out = readEvents(p);
  assert.equal(out.length, 1);
  assert.equal(out[0].issue, 1);
});

test('readEvents skips events missing required fields', () => {
  const p = tmpFile([
    JSON.stringify({ type: 'baton:manager', issue: 1, role: 'manager' }),
    JSON.stringify({ ts: 'x', type: 'baton:manager', role: 'manager' }),
    JSON.stringify({ ts: 'x', type: 'baton:manager', issue: 1 }),
    JSON.stringify({ ts: '2026-05-01T00:01:00Z', type: 'baton:manager', issue: 1, role: 'manager' }),
  ].join('\n'));
  assert.equal(readEvents(p).length, 1);
});

test('readEvents tolerates malformed json', () => {
  const p = tmpFile(['not json',
    JSON.stringify({ ts: '2026-05-01T00:00:00Z', type: 'baton:manager', issue: 1, role: 'manager' }),
  ].join('\n'));
  assert.equal(readEvents(p).length, 1);
});

test('groupByIssue sorts events chronologically', () => {
  const events = [
    { ts: '2026-05-01T00:02:00Z', issue: 1, role: 'admin' },
    { ts: '2026-05-01T00:01:00Z', issue: 1, role: 'manager' },
  ];
  const by = groupByIssue(events);
  assert.equal(by.get(1)[0].role, 'manager');
  assert.equal(by.get(1)[1].role, 'admin');
});

test('transitions ignores same-role pairs and negative deltas', () => {
  const by = new Map([[1, [
    { ts: '2026-05-01T00:00:00Z', issue: 1, role: 'manager' },
    { ts: '2026-05-01T00:00:01Z', issue: 1, role: 'manager' },
    { ts: '2026-05-01T00:01:00Z', issue: 1, role: 'admin' },
  ]]]);
  const d = transitions(by);
  assert.equal(d.size, 1);
  assert.ok(d.has('manager->admin'));
  assert.equal(d.get('manager->admin').length, 1);
});

test('percentile returns indexed value at chosen rank', () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
  assert.equal(percentile([], 50), null);
});

test('summarize includes all stat fields', () => {
  const d = new Map([['a->b', [100, 200, 300]]]);
  const s = summarize(d);
  assert.equal(s['a->b'].count, 3);
  assert.equal(s['a->b'].mean_ms, 200);
  assert.equal(typeof s['a->b'].p50_ms, 'number');
});

test('generate produces stable report shape', () => {
  const p = tmpFile([
    JSON.stringify({ ts: '2026-05-01T00:00:00Z', type: 'baton:manager', issue: 1, role: 'manager' }),
    JSON.stringify({ ts: '2026-05-01T00:01:00Z', type: 'baton:admin', issue: 1, role: 'admin' }),
  ].join('\n'));
  const r = generate(p);
  assert.equal(r.schema, 'baton-latency-report/v1');
  assert.equal(r.tickets_covered, 1);
  assert.equal(r.transitions['manager->admin'].count, 1);
  assert.equal(r.transitions['manager->admin'].p50_ms, 60_000);
});

test('generate handles missing file as empty report', () => {
  const r = generate('/nonexistent/path.jsonl');
  assert.equal(r.tickets_covered, 0);
  assert.deepEqual(r.transitions, {});
});
