'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parse, validate, advisoryComment, freshnessAgeHours,
  MAX_BEHIND_AT_HANDOFF, MAX_FRESHNESS_AGE_HOURS }
  = require('../scripts/global/collab-handoff-rebase-freshness.js');

test('parse: extracts behind_at_handoff field', () => {
  const r = parse('behind_at_handoff: 5');
  assert.equal(r.behind_at_handoff, 5);
});

test('parse: extracts rebase_freshness field', () => {
  const r = parse('rebase_freshness: 2026-05-18T01:00:00Z');
  assert.equal(r.rebase_freshness, '2026-05-18T01:00:00Z');
});

test('parse: both fields absent returns nulls', () => {
  const r = parse('## COLLABORATOR_HANDOFF\nticket: #1827');
  assert.equal(r.behind_at_handoff, null);
  assert.equal(r.rebase_freshness, null);
});

test('parse: equals-form accepted', () => {
  const r = parse('behind_at_handoff=3\nrebase_freshness=2026-01-01T00:00:00Z');
  assert.equal(r.behind_at_handoff, 3);
  assert.equal(r.rebase_freshness, '2026-01-01T00:00:00Z');
});

test('freshnessAgeHours: parses ISO and returns hours', () => {
  const now = Date.parse('2026-05-18T10:00:00Z');
  const age = freshnessAgeHours('2026-05-18T08:00:00Z', now);
  assert.equal(age, 2);
});

test('freshnessAgeHours: unparseable returns null', () => {
  assert.equal(freshnessAgeHours('not-iso', Date.now()), null);
});

test('validate: missing fields → advisories not violations', () => {
  const r = validate('## COLLABORATOR_HANDOFF');
  assert.equal(r.ok, true);
  assert.ok(r.advisories.includes('missing-behind-at-handoff'));
  assert.ok(r.advisories.includes('missing-rebase-freshness'));
  assert.equal(r.violations.length, 0);
});

test('validate: behind > MAX → violation', () => {
  const r = validate(`behind_at_handoff: ${MAX_BEHIND_AT_HANDOFF + 5}\nrebase_freshness: 2026-05-18T01:00:00Z`,
    { now: Date.parse('2026-05-18T02:00:00Z') });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some(v => v.rule === 'behind-at-handoff-exceeds-rescope-tier'));
});

test('validate: rebase_freshness too old → violation', () => {
  const r = validate('behind_at_handoff: 2\nrebase_freshness: 2026-05-18T00:00:00Z',
    { now: Date.parse(`2026-05-18T${String(MAX_FRESHNESS_AGE_HOURS + 2).padStart(2, '0')}:00:00Z`) });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some(v => v.rule === 'rebase-freshness-too-old'));
});

test('validate: valid fields within limits → ok no violations', () => {
  const r = validate('behind_at_handoff: 3\nrebase_freshness: 2026-05-18T08:00:00Z',
    { now: Date.parse('2026-05-18T10:00:00Z') });
  assert.equal(r.ok, true);
  assert.equal(r.violations.length, 0);
});

test('advisoryComment: returns null when fully ok', () => {
  const r = validate('behind_at_handoff: 3\nrebase_freshness: 2026-05-18T08:00:00Z',
    { now: Date.parse('2026-05-18T10:00:00Z') });
  assert.equal(advisoryComment(r), null);
});

test('advisoryComment: bridge-mode advisory when fields missing', () => {
  const r = validate('');
  const comment = advisoryComment(r);
  assert.match(comment, /collab-handoff-rebase-freshness/);
  assert.match(comment, /behind_at_handoff/);
  assert.match(comment, /Epic #1827/);
});

test('MAX_BEHIND_AT_HANDOFF = 30 (matches pre-handoff-block tier ceiling)', () => {
  assert.equal(MAX_BEHIND_AT_HANDOFF, 30);
});

test('MAX_FRESHNESS_AGE_HOURS = 8 (matches pre-handoff-block effective_drift ceiling)', () => {
  assert.equal(MAX_FRESHNESS_AGE_HOURS, 8);
});
