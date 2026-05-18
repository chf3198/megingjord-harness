'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { evaluate, findMarkers, RECOGNITION_MARKERS, DECISION_MARKERS }
  = require('../scripts/global/anneal-decision-detector.js');

const SKIP = { skipRecordedScan: true };

test('findMarkers: catches "if you want"', () => {
  const hits = findMarkers('Maybe, if you want, we can file a ticket.', RECOGNITION_MARKERS);
  assert.equal(hits.length, 1);
});

test('findMarkers: catches "should we file"', () => {
  const hits = findMarkers('Should we file a follow-up?', RECOGNITION_MARKERS);
  assert.equal(hits.length, 1);
});

test('findMarkers: catches "this is a recurrence"', () => {
  const hits = findMarkers('Note: this is a recurrence of #1554.', RECOGNITION_MARKERS);
  assert.equal(hits.length, 1);
});

test('findMarkers: catches "trap class"', () => {
  const hits = findMarkers('Same trap class as before.', RECOGNITION_MARKERS);
  assert.equal(hits.length, 1);
});

test('findMarkers: catches "violation"/"drift"/"regression"', () => {
  assert.equal(findMarkers('Found a violation.', RECOGNITION_MARKERS).length, 1);
  assert.equal(findMarkers('Drift detected.', RECOGNITION_MARKERS).length, 1);
  assert.equal(findMarkers('Possible regression.', RECOGNITION_MARKERS).length, 1);
});

test('findMarkers: catches "flaw in"/"gap with"', () => {
  assert.equal(findMarkers('a flaw in the parser', RECOGNITION_MARKERS).length, 1);
  assert.equal(findMarkers('gap with the validator', RECOGNITION_MARKERS).length, 1);
});

test('findMarkers DECISION: catches decision=file-ticket', () => {
  assert.equal(findMarkers('decision=file-ticket', DECISION_MARKERS).length, 1);
  assert.equal(findMarkers('decision: log-incident-only', DECISION_MARKERS).length, 1);
  assert.equal(findMarkers('decision: memory-note-only', DECISION_MARKERS).length, 1);
  assert.equal(findMarkers('decision: no-action-justified', DECISION_MARKERS).length, 1);
});

test('evaluate: pure recognition without decision returns not-ok', () => {
  const r = evaluate('If you want, we should file a ticket.\nThis is a recurrence.', SKIP);
  assert.equal(r.ok, false);
  assert.ok(r.recognitions_count >= 2);
  assert.equal(r.inline_decisions, 0);
  assert.ok(r.unmatched_recognitions >= 1);
});

test('evaluate: recognition + inline decision returns ok', () => {
  const text = 'This is a recurrence. decision=file-ticket pattern_id=foo';
  const r = evaluate(text, SKIP);
  assert.equal(r.ok, true);
  assert.equal(r.recognitions_count, 1);
  assert.equal(r.inline_decisions, 1);
});

test('evaluate: zero recognitions → ok', () => {
  const r = evaluate('Implementation is straightforward. Everything is fine.', SKIP);
  assert.equal(r.ok, true);
  assert.equal(r.recognitions_count, 0);
});

test('evaluate: counts each recognition line at most once', () => {
  const text = 'this is a recurrence flaw in the system';
  const r = evaluate(text, SKIP);
  assert.equal(r.recognitions_count, 1);
});

test('evaluate: today\'s exact incident text returns not-ok', () => {
  const text = `
    Worth a P1 Tier-2 anneal: today's session produced two concrete cross-checkout incidents.
    If you want, I can file a Tier-2 self-anneal ticket scoping "PreToolUse hook + flock-style worktree lock".
  `;
  const r = evaluate(text, SKIP);
  assert.equal(r.ok, false);
  assert.ok(r.recognitions_count >= 1);
});

test('evaluate: returns sample of recognition snippets', () => {
  const r = evaluate('If you want we should file. Drift detected.', SKIP);
  assert.ok(Array.isArray(r.recognition_samples));
  assert.ok(r.recognition_samples.length > 0);
});
