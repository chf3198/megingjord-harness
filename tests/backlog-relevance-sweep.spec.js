'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const lib = require('../scripts/global/backlog-relevance-sweep.js');
const lane = require('../scripts/global/backlog-relevance-lane.js');

// D5/D6 classifier stub: even numbers are dormant-backlog candidates.
const classify = (i) => (i.number % 2 === 0 ? ['D5'] : []);
const issues = [
  { number: 2, title: 'a', body: '', _r: 10 }, { number: 4, title: 'b', body: '', _r: 30 },
  { number: 6, title: 'c', body: '', _r: 20 }, { number: 7, title: 'odd', body: '', _r: 1 },
];

test('selectCandidates keeps only D5/D6 and applies bottom-recency quantile (no calendar)', () => {
  const c = lib.selectCandidates(issues, { classify, recencyOf: (i) => i._r, quantile: 0.5 });
  assert.deepEqual(c.map((x) => x.number), [2, 6]); // oldest two of {2,4,6}; #7 excluded (not D5/D6)
});
test('selectCandidates --force-scan returns the whole pool regardless of recency', () => {
  const c = lib.selectCandidates(issues, { classify, recencyOf: (i) => i._r, forceScan: true });
  assert.deepEqual(c.map((x) => x.number).sort(), [2, 4, 6]);
});
test('selectCandidates degrades safely on non-array', () => {
  assert.deepEqual(lib.selectCandidates(null, { classify }), []);
});

test('rankByEmbedding orders by cosine sim; identity fallback when no query vector', () => {
  const cs = [{ number: 1, v: [1, 0] }, { number: 2, v: [0, 1] }, { number: 3, v: [0.9, 0.1] }];
  const ranked = lib.rankByEmbedding(cs, [1, 0], (c) => c.v);
  assert.deepEqual(ranked.map((c) => c.number), [1, 3, 2]);
  assert.equal(lib.rankByEmbedding(cs, null), cs); // identity — no model call
});

test('aggregateVerdict: all-superseded, minority-veto, and empty fail-closed', () => {
  assert.equal(lib.aggregateVerdict([{ superseded: true, score: 0.9 }, { superseded: true, score: 0.8 }]).label, 'superseded');
  const veto = lib.aggregateVerdict([{ superseded: true, score: 0.9 }, { superseded: false, score: 0.2 }]);
  assert.equal(veto.label, 'partial'); assert.equal(veto.veto, true);
  assert.equal(lib.aggregateVerdict([]).label, 'relevant'); // fail-closed
});

test('validateEvidence enforces payload shape + acyclic transitive chain', () => {
  assert.equal(lib.validateEvidence({ artifact_id: 3519, contribution_score: 0.8, rationale: 'shipped' }).valid, true);
  assert.equal(lib.validateEvidence({ artifact_id: 3519, contribution_score: 2, rationale: 'x' }).valid, false);
  assert.equal(lib.validateEvidence({ artifact_id: 3519, contribution_score: 0.8, rationale: '' }).valid, false);
  assert.equal(lib.validateEvidence({ artifact_id: 5, contribution_score: 0.5, rationale: 'x', chain: [1, 1, 5] }).valid, false);
  assert.equal(lib.validateEvidence({ artifact_id: 5, contribution_score: 0.5, rationale: 'x', chain: [1, 3, 5] }).valid, true);
});

test('classifyFlag: live inbound pointers force PARTIAL, never superseded (AC4)', () => {
  const verdict = { label: 'superseded' }; const evidence = { valid: true };
  assert.equal(lib.classifyFlag({ verdict, inboundOrphans: [{ from: 99 }], evidence }).flag, 'partial');
  assert.equal(lib.classifyFlag({ verdict, inboundOrphans: [], evidence }).flag, 'superseded');
  assert.equal(lib.classifyFlag({ verdict, inboundOrphans: [], evidence: { valid: false, reason: 'x' } }).flag, 'partial');
});

test('redactForDispatch runs the injected redactor (G4)', () => {
  assert.equal(lib.redactForDispatch('key sk-abc', (s) => s.replace('sk-abc', '[REDACTED]')), 'key [REDACTED]');
});

test('parseModelVerdict: SUPERSEDED vs NOT-SUPERSEDED + evidence extraction', () => {
  const p = lane.parseModelVerdict('SUPERSEDED. score: 0.9 artifact_id: #3519 rationale: overtaken');
  assert.equal(p.superseded, true); assert.equal(p.evidence.artifact_id, '3519');
  assert.equal(lane.parseModelVerdict('NOT-SUPERSEDED; still relevant').superseded, false);
  assert.equal(lane.parseModelVerdict('garbage').superseded, false); // fail-safe
});

test('verdictCascade: fleet first, free-cloud failover, deterministic floor', async () => {
  const okReply = ['SUPERSEDED score: 0.9 artifact_id: #10 rationale: done'];
  const fleetOk = await lane.verdictCascade('p', { fleetPanel: async () => okReply, freeCloudPanel: async () => { throw new Error('x'); } });
  assert.equal(fleetOk.route, 'fleet');
  const failover = await lane.verdictCascade('p', { fleetPanel: async () => [], freeCloudPanel: async () => okReply });
  assert.equal(failover.route, 'free-cloud');
  const floor = await lane.verdictCascade('p', { fleetPanel: async () => [], freeCloudPanel: async () => [] });
  assert.equal(floor.route, 'deterministic-floor'); assert.equal(floor.verdicts[0].superseded, false);
});

test('runSemanticLane flags a superseded candidate but downgrades one with live inbound', async () => {
  const set = [
    { number: 2, title: 'dormant goal', body: 'old', _r: 1 },
    { number: 8, title: 'pointed-at', body: 'old', _r: 2 },
    { number: 20, title: 'live pointer', body: 'merge into #8', _r: 99 }, // makes #8 have a live inbound
  ];
  const panel = async () => ['SUPERSEDED score: 0.95 artifact_id: #3519 rationale: shipped elsewhere'];
  const out = await lane.runSemanticLane(set, {
    classify: (i) => ([2, 8].includes(i.number) ? ['D5'] : []),
    recencyOf: (i) => i._r, forceScan: true, fleetPanel: panel,
  });
  const byTicket = Object.fromEntries(out.flags.map((f) => [f.ticket, f]));
  assert.equal(byTicket[2].flag, 'superseded');
  assert.equal(byTicket[8].flag, 'partial'); // live inbound from #20 → never superseded (AC4)
  assert.deepEqual(byTicket[8].inbound, [20]);
});
