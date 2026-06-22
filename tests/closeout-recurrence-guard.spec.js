'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  extractMemoryNotePatterns,
  knownPatternIds,
  checkMemoryNoteRecurrence,
} = require('../scripts/global/closeout-recurrence-guard.js');
const closeout = require('../scripts/global/megalint/consultant-closeout.js');

function writeIncidents(patternIds) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inc-')), 'incidents.jsonl');
  fs.writeFileSync(file, patternIds.map((id) => JSON.stringify({ pattern_id: id })).join('\n'));
  return file;
}

test('extractMemoryNotePatterns captures pattern_id only when co-located with memory-note-only', () => {
  const body = [
    'mid_flight_flaws:',
    '- decision=memory-note-only pattern_id=foo-leak — judgment note',
    '- decision=file-ticket pattern_id=bar-gap — Refs #10',
    'context: pattern_id=baz-unrelated mentioned in prose only',
  ].join('\n');
  expect(extractMemoryNotePatterns(body)).toEqual(['foo-leak']);
});

test('extractMemoryNotePatterns tolerates colon and equals token forms', () => {
  const colon = 'flaw X, decision: memory-note-only, pattern_id: alpha-1';
  expect(extractMemoryNotePatterns(colon)).toEqual(['alpha-1']);
});

test('knownPatternIds skips malformed lines and a missing file', () => {
  const file = writeIncidents(['p-one', 'p-two']);
  fs.appendFileSync(file, '\nnot-json-garbage\n');
  const known = knownPatternIds(file);
  expect(known.has('p-one')).toBe(true);
  expect(known.has('p-two')).toBe(true);
  expect(knownPatternIds('/no/such/incidents.jsonl').size).toBe(0);
});

test('checkMemoryNoteRecurrence BLOCKS when the pattern already recurred', () => {
  const file = writeIncidents(['recurring-flaw']);
  const body = 'mid_flight_flaws:\n- decision=memory-note-only pattern_id=recurring-flaw';
  const violations = checkMemoryNoteRecurrence(body, { incidentsPath: file });
  expect(violations).toHaveLength(1);
  expect(violations[0].rule).toBe('memory-note-only-on-recurring-pattern');
});

test('checkMemoryNoteRecurrence PASSES for a first-occurrence pattern', () => {
  const file = writeIncidents(['some-other-pattern']);
  const body = 'mid_flight_flaws:\n- decision=memory-note-only pattern_id=brand-new';
  expect(checkMemoryNoteRecurrence(body, { incidentsPath: file })).toHaveLength(0);
});

test('checkMemoryNoteRecurrence is a no-op when no memory-note-only decision exists', () => {
  const file = writeIncidents(['recurring-flaw']);
  const body = 'mid_flight_flaws: none\nanneal_tickets_filed: [#3025]';
  expect(checkMemoryNoteRecurrence(body, { incidentsPath: file })).toHaveLength(0);
});

test('consultant-closeout.validate surfaces the recurrence violation end-to-end', () => {
  const file = writeIncidents(['e2e-recur']);
  const body = [
    '## CONSULTANT_CLOSEOUT',
    'status: review',
    'verdict: approve_for_merge',
    'verification-timestamp: 2026-06-21T00:00:00Z',
    'rubric_rating: G1:9 G2:9 G3:9 G4:9 G5:9 G6:9 G7:9 G8:9 G9:9 -> rubric 9/10',
    'anneal_tickets_filed: none',
    'mid_flight_flaws: [drift, decision=memory-note-only pattern_id=e2e-recur]',
    'Signed-by: Orla Vale',
    'Team&Model: claude-code:opus@anthropic',
    'Role: consultant',
  ].join('\n');
  const result = closeout.validate({ comments: [{ body }], incidentsPath: file, ticketRef: 3025 });
  expect(result.violations.some((v) => v.rule === 'memory-note-only-on-recurring-pattern')).toBe(true);
});
