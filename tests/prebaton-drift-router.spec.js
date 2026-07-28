'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const lib = require('../scripts/global/prebaton-drift-router.js');
const dispatch = require('../scripts/global/prebaton-drift-route.js');

test('normalizeFlag maps a C1 orphan and a C2 superseded/partial flag', () => {
  const orphan = lib.normalizeFlag({ from: 2093, cls: 'PB2' });
  assert.equal(orphan.ticket, 2093); assert.equal(orphan.cls, 'PB2'); assert.equal(orphan.proposedAction, 'seed');
  const sup = lib.normalizeFlag({ ticket: 1899, flag: 'superseded', evidence: 'shipped by #3519' });
  assert.equal(sup.cls, 'PB1'); assert.equal(sup.proposedAction, 'cancel');
  assert.equal(lib.normalizeFlag({ ticket: 10, flag: 'partial' }).proposedAction, 'seed');
});

test('classifyReversibility: P1/Epic cancel → human gate; everything else autonomous', () => {
  assert.equal(lib.classifyReversibility({ proposedAction: 'cancel', priority: 'P1' }).gate, 'human');
  assert.equal(lib.classifyReversibility({ proposedAction: 'cancel', isEpic: true }).gate, 'human');
  assert.equal(lib.classifyReversibility({ proposedAction: 'cancel', priority: 'P2' }).gate, 'autonomous');
  assert.equal(lib.classifyReversibility({ proposedAction: 'seed', priority: 'P1' }).gate, 'autonomous');
});

test('buildTriageSeed carries correction labels + Parent + Refs', () => {
  const seed = lib.buildTriageSeed(lib.normalizeFlag({ from: 2093, cls: 'PB2' }));
  assert.ok(seed.labels.includes('type:correction') && seed.labels.includes('anneal:tier-2'));
  assert.match(seed.body, /Parent: #3398/); assert.match(seed.body, /Refs #2093/);
});

test('buildHumanProposal is a proposal (needs:human-decision) that never cancels', () => {
  const p = lib.buildHumanProposal(lib.normalizeFlag({ ticket: 1899, flag: 'superseded', isEpic: true }));
  assert.ok(p.labels.includes('needs:human-decision'));
  assert.match(p.title, /HUMAN-GATE/); assert.match(p.body, /NOT `?\n?auto-executed|NOT auto-executed/i);
});

test('buildAnnealEvent is schema-v3 tier-2 with pattern_id prebaton-drift-routed', () => {
  const e = lib.buildAnnealEvent(lib.normalizeFlag({ ticket: 5, flag: 'partial' }), '2026-07-09T00:00:00Z', 'test');
  assert.equal(e.version, 3); assert.equal(e.anneal_tier, 'tier-2'); assert.equal(e.pattern_id, 'prebaton-drift-routed');
});

test('route: autonomous seed, human proposal, and skip on unresolvable ticket', () => {
  assert.equal(lib.route({ from: 2093, cls: 'PB2' }, 't').gate, 'autonomous');
  const human = lib.route({ ticket: 1899, flag: 'superseded', isEpic: true }, 't');
  assert.equal(human.gate, 'human'); assert.equal(human.seed, null); assert.ok(human.humanProposal);
  assert.equal(lib.route({ flag: 'superseded' }, 't').gate, 'skip'); // no ticket number
});

function fakeGithub(existing = 0) {
  const calls = { created: [] };
  return {
    calls,
    rest: {
      search: { issuesAndPullRequests: async () => ({ data: { total_count: existing } }) },
      issues: { create: async (a) => { calls.created.push(a); return { data: { number: 777 } }; } },
    },
  };
}
const ctx = { repo: { owner: 'chf3198', repo: 'megingjord-harness' } };

test('dispatch files an autonomous seed + emits anneal', async () => {
  const gh = fakeGithub(0); const anneals = [];
  const r = await dispatch.run({ github: gh, context: ctx, core: {} }, [{ from: 2093, cls: 'PB2' }],
    { now: 't', env: 'test', appendIncident: (e) => anneals.push(e) });
  assert.equal(r.routed[0].filed, true); assert.equal(gh.calls.created.length, 1);
  assert.equal(anneals[0].pattern_id, 'prebaton-drift-routed');
});

test('dispatch is idempotent — skips filing when a seed already exists', async () => {
  const gh = fakeGithub(1);
  const r = await dispatch.run({ github: gh, context: ctx, core: {} }, [{ from: 2093, cls: 'PB2' }],
    { now: 't', appendIncident: () => {} });
  assert.equal(r.routed[0].filed, false); assert.equal(gh.calls.created.length, 0);
});
