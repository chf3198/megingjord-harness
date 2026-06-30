'use strict';
// tests/epic-ac-disposition-check.spec.js — Ticket #1617.
// tdd-pyramid (cases a-e from the ticket AC4) + stress-test (chaos path + p99 budget).

const { test } = require('node:test');
const assert = require('node:assert');
const v = require('../scripts/global/megalint/epic-ac-disposition-check.js');

const EPIC = ['type:epic', 'status:done'];

function input(body, comments, labels = EPIC, state = 'closed') {
  return { body, labels, state, comments: (comments || []).map(b => ({ body: b })) };
}

// (a) enforce-wording + advisory artifact -> trigger
test('a: enforce-worded ticked AC + advisory-only closeout -> violation', () => {
  const body = '- [x] AC3: Enforce on PR open: the gate fails on mismatch';
  const closeout = 'CONSULTANT_EPIC_CLOSEOUT\nShipped advisory-only workflow (core.warning); promotion deferred to follow-on after soak.';
  const r = v.validate(input(body, [closeout]));
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].rule, 'enforce-ac-shipped-advisory');
  assert.equal(r.violations[0].enforce_ac_count, 1);
});

// (b) enforce-wording + required artifact -> no trigger
test('b: enforce-worded ticked AC + required-blocking closeout -> no violation', () => {
  const body = '- [x] AC3: Enforce on PR open: block the consultant-gate on mismatch';
  const closeout = 'Shipped required-blocking workflow; advisory soak completed in prior PR; now blocks via core.setFailed.';
  const r = v.validate(input(body, [closeout]));
  assert.equal(r.ok, true);
  assert.equal(r.violations.length, 0);
});

// (c) advisory-wording + advisory artifact -> no trigger (honest disclosure)
test('c: advisory-disclosed AC + advisory artifact -> no violation', () => {
  const body = '- [x] AC3 (advisory): ship advisory-first workflow; promotion deferred to follow-on';
  const closeout = 'Shipped advisory-only (core.warning); promotion deferred.';
  const r = v.validate(input(body, [closeout]));
  assert.equal(r.ok, true);
});

// (d) malformed / empty body -> safe skip (no throw, no violation)
test('d: malformed/empty body -> safe skip', () => {
  assert.equal(v.validate(input('', [])).ok, true);
  assert.equal(v.validate(input(null, null)).ok, true);
  assert.equal(v.validate({}).ok, true);
  assert.equal(v.validate(undefined).ok, true);
  // garbage body with no AC lines
  assert.equal(v.validate(input('## random\n```\n[x] not-an-ac\n```', ['advisory only'])).ok, true);
});

// (e) no advisory-shipped children -> no trigger (no advisory signal in evidence)
test('e: enforce-worded AC but closeout has no advisory signal -> no violation', () => {
  const body = '- [x] AC3: Enforce on PR open: gate fails on mismatch';
  const closeout = 'CONSULTANT_EPIC_CLOSEOUT\nAll children merged; required checks green.';
  const r = v.validate(input(body, [closeout]));
  assert.equal(r.ok, true);
});

// Scope guards
test('scope: non-epic terminal ticket is skipped', () => {
  const body = '- [x] AC1: Enforce blocking gate';
  const r = v.validate(input(body, ['advisory only'], ['type:task', 'status:done']));
  assert.equal(r.ok, true);
  assert.equal(r.skipped, true);
});

test('scope: open (live) Epic is skipped', () => {
  const body = '- [x] AC1: Enforce blocking gate';
  const r = v.validate(input(body, ['advisory only'], ['type:epic', 'status:in-progress'], 'open'));
  assert.equal(r.skipped, true);
});

test('scope: cancelled Epic is skipped (goal invalidated, no over-claim)', () => {
  const body = '- [x] AC1: Enforce blocking gate';
  const r = v.validate(input(body, ['advisory only'], ['type:epic', 'status:cancelled']));
  assert.equal(r.skipped, true);
});

test('unticked enforce AC does not trigger (not claimed as shipped)', () => {
  const body = '- [ ] AC3: Enforce on PR open: gate fails on mismatch';
  const r = v.validate(input(body, ['advisory only']));
  assert.equal(r.ok, true);
});

test('vocab: "enforcement required" wording also detected', () => {
  const body = '- [x] AC2: enforcement required on PR open before merge';
  const r = v.validate(input(body, ['shipped advisory-only core.warning; promotion deferred']));
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].rule, 'enforce-ac-shipped-advisory');
});

// ---- stress-test: chaos / fault-injection (G6) + p99 latency budget (G7) ----
test('stress: chaos inputs never throw + p99 latency budget', () => {
  const samples = [];
  const chaos = [
    'x'.repeat(50000),                                  // huge body
    '- [x] AC1: enforce\n'.repeat(2000),                // many AC lines
    '\x00\x01\x07\uFFFF- [x] AC1: enforce blocking gate', // control/unicode chars
    '- [x] AC' + '1'.repeat(5000) + ': enforce',        // pathological AC id
    '```\n' + '- [x] AC1: enforce block '.repeat(1000), // unterminated fence
    null, undefined, '', '\n\n\n',                       // empties
  ];
  for (let i = 0; i < 400; i++) {
    const body = chaos[i % chaos.length];
    const commentsChaos = (i % 3 === 0) ? ['advisory only ' + 'z'.repeat(i)] : [{ body: null }, 'promotion deferred'];
    const start = process.hrtime.bigint();
    let r;
    assert.doesNotThrow(() => { r = v.validate(input(body, commentsChaos)); });
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
    assert.ok(r && typeof r.ok === 'boolean');
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  // p99 budget: a single classification must stay well under 50ms even on chaos input.
  assert.ok(p99 < 50, `p99 ${p99.toFixed(2)}ms exceeded 50ms budget`);
});
