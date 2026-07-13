'use strict';
// Unit tests for baton-back-set (Epic #3251 #3259 D4): phase-exit wiring that
// plans + applies the timeline comment, ledger event, and disclosure labels.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { planMarkerSet, applyMarkerSet, REVIEW_COVERAGE_LABELS } =
  require('../scripts/global/baton-back-set.js');
const { routeFindings } = require('../scripts/global/cross-model-finding-router.js');

function sampleRoute() {
  return routeFindings({ review_coverage: 'cross-family-free', findings: [
    { id: 'F1', blocking: true, touches_file: true, summary: 'fix' }] });
}

test('planMarkerSet emits a BATON_BACK comment + baton-back:open + coverage label', () => {
  const plan = planMarkerSet(sampleRoute(), 3258);
  assert.equal(plan.comments.length, 1);
  assert.match(plan.comments[0], /^## BATON_BACK/);
  assert.ok(plan.labels.includes('baton-back:open'));
  assert.ok(plan.labels.includes('review-coverage:cross-family-free'));
  assert.equal(plan.open, true);
});

test('planMarkerSet with no markers emits no comments, no baton-back:open label', () => {
  const plan = planMarkerSet(routeFindings({ findings: [] }), 3258);
  assert.equal(plan.comments.length, 0);
  assert.equal(plan.labels.includes('baton-back:open'), false);
  assert.equal(plan.open, false);
});

test('planMarkerSet drops an unknown coverage grade (fail-closed)', () => {
  const plan = planMarkerSet(sampleRoute(), 1, 'totally-made-up');
  assert.equal(plan.labels.some((l) => l.startsWith('review-coverage:')), false);
  REVIEW_COVERAGE_LABELS.forEach((g) => assert.equal(typeof g, 'string'));
});

test('applyMarkerSet drives injected side effects in order', async () => {
  const posted = []; const labeled = []; const evented = [];
  const plan = await applyMarkerSet(sampleRoute(), 3258, {
    postComment: async (t, body) => posted.push([t, body]),
    setLabels: async (t, labels) => labeled.push([t, labels]),
    appendEvent: (t, m) => evented.push([t, m.remediator]),
  });
  assert.equal(posted.length, 1);
  assert.equal(posted[0][0], 3258);
  assert.match(posted[0][1], /BATON_BACK/);
  assert.equal(evented[0][1], 'collaborator');
  assert.deepEqual(labeled[0][1], ['baton-back:open', 'review-coverage:cross-family-free']);
  assert.equal(plan.open, true);
});
