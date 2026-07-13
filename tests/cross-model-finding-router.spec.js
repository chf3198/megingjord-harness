'use strict';
// Unit tests for cross-model-finding-router (Epic #3251 #3258 D1): the Layer-B
// adapter that turns structured review findings into baton-back markers via the
// shipped router. Covers AC1: parse -> route; malformed input is fail-closed.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  parseFindings, toRoutingFlags, reviewCoverageOf, routeFindings,
} = require('../scripts/global/cross-model-finding-router.js');

test('parseFindings accepts object, array, JSON string, and fenced json', () => {
  assert.equal(parseFindings({ findings: [{ id: 'A' }] }).length, 1);
  assert.equal(parseFindings([{ id: 'A' }, { id: 'B' }]).length, 2);
  assert.equal(parseFindings('{"findings":[{"id":"A"}]}').length, 1);
  const fenced = '```json\n{"findings":[{"id":"Z"}]}\n```';
  assert.equal(parseFindings(fenced)[0].id, 'Z');
});

test('parseFindings is fail-closed on garbage / non-objects (never throws)', () => {
  assert.deepEqual(parseFindings('not json at all'), []);
  assert.deepEqual(parseFindings(''), []);
  assert.deepEqual(parseFindings(null), []);
  assert.deepEqual(parseFindings(42), []);
  assert.deepEqual(parseFindings({ findings: 'nope' }), []);
  assert.deepEqual(parseFindings([1, 'x', null, { id: 'ok' }]).map((f) => f.id), ['ok']);
});

test('toRoutingFlags translates snake_case -> routeRemediation camelCase flags', () => {
  const f = toRoutingFlags({ touches_file: true, current_role: 'admin' });
  assert.equal(f.touchesFile, true);
  assert.equal(f.currentRole, 'admin');
  assert.equal(f.environmental, false);
  assert.equal(f.governanceMetadata, false);
});

test('routeFindings creates one marker per BLOCKING finding, deterministically routed', () => {
  const raw = { review_coverage: 'cross-family-free', findings: [
    { id: 'F1', blocking: true, touches_file: true, summary: 'fix code' },
    { id: 'F2', blocking: true, governance_metadata: true },
    { id: 'F3', blocking: true, environmental: true },
    { id: 'F4', blocking: false, touches_file: true }, // advisory: no marker
  ] };
  const out = routeFindings(raw, { source: 'layerB' });
  assert.equal(out.routed, 3);
  assert.deepEqual(out.skipped, ['F4']);
  assert.equal(out.markers[0].remediator, 'collaborator'); // touches_file -> collaborator
  assert.equal(out.markers[0].impact, 'baton-back');
  assert.equal(out.markers[0].lesson, 'fix code');
  assert.equal(out.markers[0].review, 'cross-family-free');
  assert.equal(out.markers[1].remediator, 'manager'); // governance_metadata -> manager/hold
  assert.equal(out.markers[1].impact, 'hold');
  assert.equal(out.markers[2].impact, 'override'); // environmental -> override, no remediator
  assert.equal(out.markers[2].remediator, null);
});

test('routeFindings on empty/garbage yields zero markers (no false baton-back)', () => {
  assert.equal(routeFindings('garbage').routed, 0);
  assert.equal(routeFindings({ findings: [] }).routed, 0);
  assert.equal(routeFindings(null).markers.length, 0);
});

test('reviewCoverageOf extracts the disclosure grade when present', () => {
  assert.equal(reviewCoverageOf({ review_coverage: 'programmatic-only' }), 'programmatic-only');
  assert.equal(reviewCoverageOf({}), null);
  assert.equal(reviewCoverageOf('x'), null);
});
