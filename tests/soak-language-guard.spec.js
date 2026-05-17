'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const {
  validate, detectMentions, scanFile, SOAK_PATTERNS, OVERRIDE_RE, OVERRIDE_LABEL,
} = require('../scripts/global/megalint/soak-language-guard.js');

function tempFile(content) {
  const p = path.join(os.tmpdir(), `soak-lint-${Date.now()}-${Math.random()}.md`);
  fs.writeFileSync(p, content);
  return p;
}

test('detects "14-day soak"', () => {
  const hits = detectMentions('We will run a 14-day soak before promoting.');
  assert.equal(hits.length, 1);
  assert.match(hits[0].match, /14-day soak/i);
});

test('detects multi-day / N-day / calendar / N-days-to / soak-period variants', () => {
  for (const t of [
    'needs multi-day soak', 'a multi-day window of measurement', '30-day window is needed',
    'this is a calendar soak', '7 days to validate', '14 days to promote',
    'the soak period begins', 'soak phase', 'the soak window opens',
  ]) assert.equal(detectMentions(t).length, 1, `failed for: ${t}`);
});

test('does NOT flag plain ISO dates or audit windows that are not soaks', () => {
  assert.equal(detectMentions('Closed on 2026-05-17').length, 0);
  assert.equal(detectMentions('git log --since=2 hours ago').length, 0);
  assert.equal(detectMentions('audit run snapshot taken at 2026-05-17T03:00:00Z').length, 0);
});

test('does NOT flag the word "soak" alone (only soak-as-procedure phrases)', () => {
  // Bare "soak" without period/phase/window or N-day prefix is allowed.
  assert.equal(detectMentions('the noun soak appears').length, 0);
});

test('honors <!-- soak-language-override --> HTML comment on same line', () => {
  const text = 'needs 14-day soak <!-- soak-language-override: high-novelty operator env -->';
  assert.equal(detectMentions(text).length, 0);
});

test('OVERRIDE_LABEL skip path returns ok=true with skipped reason', () => {
  const r = validate({ labels: [OVERRIDE_LABEL], comments: [{ body: 'MANAGER_HANDOFF needs 14-day soak' }] });
  assert.equal(r.ok, true);
  assert.equal(r.skipped, 'override-approved');
});

test('validate flags baton artifact comments containing soak phrases', () => {
  const r = validate({
    labels: [],
    comments: [{ body: '## CONSULTANT_CLOSEOUT\nneeds 30-day window' }],
  });
  assert.equal(r.ok, false);
  assert.equal(r.violations.length, 1);
  assert.equal(r.violations[0].rule, 'soak-language-detected');
});

test('validate ignores non-baton comments', () => {
  const r = validate({ labels: [], comments: [{ body: 'plain comment with 14-day soak phrase' }] });
  assert.equal(r.ok, true);
});

test('validate flags PR body soak phrases via soak-language-in-pr-body rule', () => {
  const r = validate({ labels: [], comments: [], prBody: 'PR body claims 7-day soak' });
  assert.equal(r.ok, false);
  assert.equal(r.violations[0].rule, 'soak-language-in-pr-body');
});

test('scanFile returns line numbers and matched substring', () => {
  const p = tempFile('line one\nneeds 14-day soak\nline three\n');
  const hits = scanFile(p);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 2);
  assert.equal(hits[0].file, p);
  fs.unlinkSync(p);
});

test('exactly 7 patterns ship in SOAK_PATTERNS', () => {
  assert.equal(SOAK_PATTERNS.length, 7);
});

test('OVERRIDE_RE matches the documented comment shape', () => {
  assert.ok(OVERRIDE_RE.test('<!-- soak-language-override: reason here -->'));
  assert.ok(!OVERRIDE_RE.test('plain text without comment'));
});
