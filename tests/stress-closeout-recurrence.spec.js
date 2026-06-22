'use strict';
// Stress coverage for closeout-recurrence-guard (#3025) — adversarial-input parser.
// Asserts a chaos/fault-injection path (G6) AND a p99 parse-latency budget (G7),
// per test-methodology-matrix.instructions.md.

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  extractMemoryNotePatterns,
  knownPatternIds,
  checkMemoryNoteRecurrence,
} = require('../scripts/global/closeout-recurrence-guard.js');

// Adversarial corpus — each entry must parse without throwing and must NOT
// over-match (only a same-line decision+pattern_id co-occurrence counts).
// Control/noncharacter bytes are spelled as \u escapes so this source stays
// plain UTF-8 text (never git-detected as binary).
const ADVERSARIAL = [
  '', '\n\n\n',
  'memory-note-only with no pattern token at all',
  'pattern_id=lonely with no decision token',
  'decision=memory-note-only\npattern_id=on-the-next-line-not-same-line',
  '<script>memory-note-only pattern_id=inject</script>',
  'memory-note-only '.repeat(5000) + 'pattern_id=tail-after-flood',
  'pattern_id=a;'.repeat(3000),
  'decision=memory-note-only pattern_id=' + 'x'.repeat(2000),
  '  decision=memory-note-only pattern_id=ctrl-chars \uFFFF\u200B',
  'DECISION=MEMORY-NOTE-ONLY PATTERN_ID=UPPER-CASE',
];

test('chaos: malformed bodies and a missing incidents file never throw (G6)', () => {
  for (const body of ADVERSARIAL) {
    expect(() => extractMemoryNotePatterns(body)).not.toThrow();
    expect(() => checkMemoryNoteRecurrence(body, { incidentsPath: '/no/such/file.jsonl' })).not.toThrow();
  }
  // Fault injection: non-string and nullish bodies degrade to no-match, not a crash.
  expect(extractMemoryNotePatterns(null)).toEqual([]);
  expect(extractMemoryNotePatterns({ evil: true })).toEqual([]);
});

test('chaos: incidents file packed with garbage lines yields a usable set (G6)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-inc-'));
  const file = path.join(dir, 'incidents.jsonl');
  const lines = [];
  for (let index = 0; index < 2000; index += 1) {
    lines.push(index % 3 === 0 ? 'corrupt{not json' : JSON.stringify({ pattern_id: `p-${index}` }));
  }
  fs.writeFileSync(file, lines.join('\n'));
  const known = knownPatternIds(file);
  expect(known.has('p-1')).toBe(true);
  expect(known.size).toBeGreaterThan(1000);
});

test('p99 parse latency stays within budget under load (G7)', () => {
  const big = ('filler line of closeout prose\n'.repeat(200))
    + 'mid_flight_flaws:\n- decision=memory-note-only pattern_id=hot-path';
  const samples = [];
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    const start = process.hrtime.bigint();
    extractMemoryNotePatterns(big);
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  samples.sort((a, b) => a - b);
  const p99 = samples[Math.floor(samples.length * 0.99)];
  expect(p99).toBeLessThan(5); // < 5 ms p99 per parse
});
