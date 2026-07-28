'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const lib = require('../scripts/global/inbound-reference-integrity.js');
const action = require('../scripts/global/inbound-reference-integrity-check.js');

const items = [
  { number: 10, text: 'We should merge into #3419 eventually' },
  { number: 11, text: 'This is blocked by #3419 for now' },
  { number: 12, text: 'survivor: #3419 is canonical' },
  { number: 13, text: 'Parent: #3419' },
  { number: 14, text: 'unrelated work, mentions #34190 and #341' },
  { number: 3419, text: 'blocked by #3419 (self — must be ignored)' },
];

test('scanInbound detects each catalog form and tags PB2/PB4', () => {
  const o = lib.scanInbound(3419, items);
  const byForm = Object.fromEntries(o.map((x) => [x.form, x]));
  assert.equal(byForm['merge-into'].from, 10);
  assert.equal(byForm['blocked-by'].cls, 'PB4');
  assert.equal(byForm['survivor'].from, 12);
  assert.equal(byForm['parent-ref'].from, 13);
});

test('scanInbound excludes the closing issue itself and avoids number-boundary false positives', () => {
  const o = lib.scanInbound(3419, items);
  assert.ok(!o.some((x) => x.from === 3419), 'self excluded');
  assert.ok(!o.some((x) => x.from === 14), 'no #34190/#341 false positive');
});

test('scanInbound tolerates degraded input (fail-safe)', () => {
  assert.deepEqual(lib.scanInbound(1, null), []);
  assert.deepEqual(lib.scanInbound(1, [null, { text: 'x' }, {}]), []);
});

test('buildCorrectionTask names froms + carries governance labels + parent', () => {
  const o = lib.scanInbound(3419, items);
  const t = lib.buildCorrectionTask(3419, o);
  assert.match(t.title, /Re-home orphaned reference to #3419 from/);
  assert.ok(t.labels.includes('type:correction') && t.labels.includes('area:governance'));
  assert.match(t.body, /Parent: #3398/);
  assert.match(t.body, /Refs #3419/);
});

test('buildIncident is schema-v3 shaped with pattern_id inbound-reference-orphan', () => {
  const o = lib.scanInbound(3419, items);
  const inc = lib.buildIncident(3419, o, '2026-07-09T00:00:00Z', 'test');
  assert.equal(inc.version, 3);
  assert.equal(inc.pattern_id, 'inbound-reference-orphan');
  assert.equal(inc.ts, inc.timestamp);
  assert.ok(['local', 'ci', 'cloudflare', 'test'].includes(inc.env));
  assert.equal(inc.orphan_count, o.length);
});

function fakeGithub(open, filedCount = 0) {
  const calls = { created: [], comments: [] };
  return {
    calls,
    graphql: async () => ({ repository: { issues: { nodes: open.map((n) => ({ number: n.number, title: "", body: n.text })), pageInfo: { hasNextPage: false } } } }),
    rest: {
      search: { issuesAndPullRequests: async () => ({ data: { total_count: filedCount } }) },
      issues: {
        create: async (a) => { calls.created.push(a); return { data: { number: 999 } }; },
        createComment: async (a) => { calls.comments.push(a); },
      },
    },
  };
}
const ctx = { repo: { owner: 'chf3198', repo: 'megingjord-harness' }, issue: { number: 3419 } };

test('action files a correction + BLOCKER_NOTE + incident on dangling pointers', async () => {
  const gh = fakeGithub(items.slice(0, 4));
  const incidents = [];
  const r = await action.run({ github: gh, context: ctx, core: {} },
    { now: '2026-07-09T00:00:00Z', env: 'test', appendIncident: (e) => incidents.push(e) });
  assert.equal(r.filed, true);
  assert.equal(r.correction, 999);
  assert.equal(gh.calls.created.length, 1);
  assert.match(gh.calls.comments[0].body, /BLOCKER_NOTE — inbound-reference-orphan/);
  assert.equal(incidents[0].pattern_id, 'inbound-reference-orphan');
});

test('action is idempotent — skips filing when a correction already exists', async () => {
  const gh = fakeGithub(items.slice(0, 4), 1);
  const r = await action.run({ github: gh, context: ctx, core: {} }, { appendIncident: () => {} });
  assert.equal(r.filed, false);
  assert.equal(gh.calls.created.length, 0);
});

test('action is a no-op on a clean close', async () => {
  const gh = fakeGithub([{ number: 20, text: 'nothing to see' }]);
  const r = await action.run({ github: gh, context: ctx, core: {} }, { appendIncident: () => {} });
  assert.deepEqual(r.orphans, []);
  assert.equal(gh.calls.created.length, 0);
});
