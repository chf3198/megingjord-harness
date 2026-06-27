'use strict';
// Refs #2801 — tdd-pyramid tests for corpus-overlap-scan (AC1-AC4).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  scanCorpusOverlap, classify, hasOverlapDecision,
  shouldBlockAccept, buildOverlapBlock, reviewerOverlapFragment
} = require('../scripts/global/corpus-overlap-scan');

// Corpus deliberately includes a CLOSED epic (#2518, the documented near-miss)
// to prove the stage scans open+closed, not open-only like #2617's scanner.
const CORPUS = [
  {
    number: 2518, state: 'CLOSED',
    title: 'Epic: cross-team fleet utilization patience policy shared observability',
    body: 'cost-aware routing fleet utilization observability cross-team patience policy shared metrics'
  },
  {
    number: 9001, state: 'OPEN',
    title: 'Add dark-mode toggle to dashboard header',
    body: 'css theme toggle button accessibility contrast'
  }
];
const fetchStub = () => CORPUS.map(i => ({ ...i }));

test('AC1/AC4 missed-overlap caught: scope overlapping a CLOSED epic is surfaced (open+closed scan)', () => {
  const scope = 'design for cost-aware routing and fleet utilization with shared observability metrics across teams';
  const r = scanCorpusOverlap(scope, { fetchIssues: fetchStub });
  const hit = r.candidates.find(c => c.number === 2518);
  assert.ok(hit, 'closed epic #2518 must be surfaced');
  assert.equal(hit.state, 'closed');
  assert.ok(r.relatedTickets.includes('#2518'));
});

test('AC4 gap classified: novel scope with no corpus match → finding=gap', () => {
  const scope = 'implement quantum teleportation widget for holographic spreadsheet rendering pipeline';
  const r = scanCorpusOverlap(scope, { fetchIssues: fetchStub });
  assert.equal(r.overlapLevel, 'none');
  assert.equal(r.finding, 'gap');
});

test('AC4 redundancy classified: near-duplicate scope → redundancy candidate', () => {
  const scope = 'cross-team fleet utilization patience policy shared observability cost-aware routing metrics';
  const r = scanCorpusOverlap(scope, { fetchIssues: fetchStub });
  const hit = r.candidates.find(c => c.number === 2518);
  assert.equal(hit.classification, 'redundancy');
  assert.equal(r.overlapLevel, 'high');
});

test('classify thresholds: redundancy / overlap / below-floor', () => {
  assert.equal(classify(0.9), 'redundancy');
  assert.equal(classify(0.3), 'overlap');
  assert.equal(classify(0.1), null);
});

test('AC3 ACCEPT blocked when overlap high and no overlap_decision recorded', () => {
  const scope = 'cross-team fleet utilization shared observability cost-aware routing';
  const r = scanCorpusOverlap(scope, { fetchIssues: fetchStub });
  assert.equal(shouldBlockAccept(r, 'a deliverable with no decision line'), true);
});

test('AC3 recorded-boundary passes: overlap_decision present → not blocked', () => {
  const scope = 'cross-team fleet utilization shared observability cost-aware routing';
  const r = scanCorpusOverlap(scope, { fetchIssues: fetchStub });
  const deliverable = 'analysis text...\noverlap_decision: distinct-stage, reuses machinery, no duplication\n';
  assert.equal(hasOverlapDecision(deliverable), true);
  assert.equal(shouldBlockAccept(r, deliverable), false);
});

test('gap finding never blocks ACCEPT', () => {
  const r = scanCorpusOverlap('totally novel unrelated zorblax topic', { fetchIssues: fetchStub });
  assert.equal(shouldBlockAccept(r, 'no decision present'), false);
});

test('AC2 reviewer fragment lists candidates for boundary judgement', () => {
  const scope = 'cross-team fleet utilization shared observability cost-aware routing';
  const r = scanCorpusOverlap(scope, { fetchIssues: fetchStub });
  const frag = reviewerOverlapFragment(r);
  assert.match(frag, /#2518/);
  assert.match(frag, /overlap, conflict, redundancy, or gap/);
});

test('buildOverlapBlock emits related_tickets + overlap_decision fields', () => {
  const r = scanCorpusOverlap('cross-team fleet utilization shared observability', { fetchIssues: fetchStub });
  const block = buildOverlapBlock(r);
  assert.match(block, /related_tickets:/);
  assert.match(block, /overlap_decision:/);
});

test('exclude option omits the design ticket itself from candidates', () => {
  const scope = 'cross-team fleet utilization shared observability cost-aware routing';
  const r = scanCorpusOverlap(scope, { fetchIssues: fetchStub, exclude: [2518] });
  assert.equal(r.candidates.find(c => c.number === 2518), undefined);
});
