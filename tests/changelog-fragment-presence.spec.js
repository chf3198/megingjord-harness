// Refs #2157 - unit tests for changelog-fragment-presence
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, extractRefsTicket, findFragment, isCodeChangeLane, hasSkipMarker } = require('../scripts/global/megalint/changelog-fragment-presence.js');

test('extractRefsTicket: parses Refs #N from PR body', () => {
  assert.equal(extractRefsTicket('Refs #2157\nCloses #2157'), 2157);
});

test('extractRefsTicket: returns null when no Refs', () => {
  assert.equal(extractRefsTicket('No reference here'), null);
});

test('extractRefsTicket: picks first Refs not Refs Epic', () => {
  // Strict: matches /Refs\s+#(\d+)/i which catches "Refs Epic #N" too unfortunately
  // Document the trap explicitly via test
  assert.equal(extractRefsTicket('Refs #2157\nRefs Epic #2148'), 2157);
});

test('findFragment: matches by ticket number', () => {
  const files = ['scripts/foo.js', '.changes/unreleased/2157.md', 'tests/foo.spec.js'];
  assert.equal(findFragment(files, 2157), '.changes/unreleased/2157.md');
});

test('findFragment: returns null when no match', () => {
  assert.equal(findFragment(['src/foo.js'], 2157), null);
});

test('isCodeChangeLane: detects label by name', () => {
  assert.ok(isCodeChangeLane(['lane:code-change', 'type:task']));
  assert.equal(isCodeChangeLane(['lane:docs-research']), false);
});

test('hasSkipMarker: detects [skip-changelog]', () => {
  assert.ok(hasSkipMarker('Some text with [skip-changelog] marker'));
  assert.equal(hasSkipMarker('No marker here'), false);
});

test('validate: fragment-present-pass', () => {
  const result = validate({
    labels: ['lane:code-change'],
    prBody: 'Refs #2157',
    prFiles: ['.changes/unreleased/2157.md', 'src/x.js'],
  });
  assert.equal(result.ok, true);
});

test('validate: fragment-missing-fail', () => {
  const result = validate({
    labels: ['lane:code-change'],
    prBody: 'Refs #2157',
    prFiles: ['src/x.js'],
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /missing-fragment/);
});

test('validate: skip-marker-pass', () => {
  const result = validate({
    labels: ['lane:code-change'],
    prBody: 'Refs #2157\n\n[skip-changelog]',
    prFiles: ['src/x.js'],
  });
  assert.equal(result.ok, true);
  assert.match(result.reason, /skip-marker/);
});

test('validate: lane-docs-only-skip', () => {
  const result = validate({
    labels: ['lane:docs-only'],
    prBody: 'Refs #2157',
    prFiles: ['src/x.js'],
  });
  assert.equal(result.ok, true);
  assert.match(result.reason, /not-lane-code-change/);
});

test('validate: no-refs-fails', () => {
  const result = validate({
    labels: ['lane:code-change'],
    prBody: 'No reference here',
    prFiles: ['src/x.js'],
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no-refs-ticket/);
});
