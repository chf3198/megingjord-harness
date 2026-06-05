// Unit tests for the PR-body / CHANGELOG-fragment / commit-trailer builders
// (Epic #2037 P1.2, Refs #2672). Uses @playwright/test to run in the
// quality-gates deterministic unit-test list. Covers determinism (byte-identical),
// Refs-first ordering, pr-title subject-length validation, changelog fragment
// naming + section validation, and derived (never hand-typed) commit-trailer signer.
const { test, expect } = require('@playwright/test');
const {
  buildPrBody, buildChangelogFragment, buildCommitTrailers, validatePrTitle, MAX_SUBJECT,
} = require('../scripts/global/baton-pr-builders');
const { deriveSigner } = require('../scripts/global/baton-artifact-builder');

const TM = 'claude-code:opus@anthropic';

function prInput() {
  return {
    ticket: 2672, title: 'feat(governance): programmatic PR + changelog builders',
    lane: 'lane:code-change', testStrategy: 'tdd-pyramid', summary: 'Add the builders.',
    artifacts: { collaborator: '## COLLABORATOR_HANDOFF\nx', admin: '## ADMIN_HANDOFF\ny', consultant: '## CONSULTANT_CLOSEOUT\nz' },
  };
}

test('PR body puts Refs #N first (validator regex anchor)', () => {
  const body = buildPrBody(prInput());
  expect(body.startsWith('Refs #2672')).toBe(true);
  expect(body).toContain('merge-evidence-deferred-final: #2672');
});

test('PR body carries all 3 baton-artifact strings (baton-gates CI)', () => {
  const body = buildPrBody(prInput());
  for (const tok of ['COLLABORATOR_HANDOFF', 'ADMIN_HANDOFF', 'CONSULTANT_CLOSEOUT']) {
    expect(body).toContain(tok);
  }
});

test('PR body is byte-identical for identical input (deterministic)', () => {
  expect(buildPrBody(prInput())).toBe(buildPrBody(prInput()));
});

test('siblings render and backward-compat Closes form is honored', () => {
  const body = buildPrBody({ ...prInput(), siblings: [2673, '#2674'], mergeEvidence: 'Closes #2672' });
  expect(body).toContain('siblings: #2673, #2674');
  expect(body).toContain('Closes #2672');
  expect(body).not.toContain('merge-evidence-deferred-final');
});

test('PR body rejects a malformed mergeEvidence value', () => {
  expect(() => buildPrBody({ ...prInput(), mergeEvidence: 'whatever #2672' })).toThrow(/mergeEvidence must be/);
  expect(() => buildPrBody({ ...prInput(), mergeEvidence: 'Fixes #2672' })).not.toThrow();
});

test('validatePrTitle rejects an over-60-char subject', () => {
  const longSubject = 'x'.repeat(MAX_SUBJECT + 1);
  expect(() => validatePrTitle(`feat(x): ${longSubject}`)).toThrow(/subject must be 1-60/);
  expect(validatePrTitle('feat(x): ok')).toBe('feat(x): ok');
});

test('validatePrTitle requires a Conventional-Commit prefix', () => {
  expect(() => validatePrTitle('just a sentence')).toThrow(/Conventional-Commit prefix/);
});

test('changelog fragment is named per ticket and validates section', () => {
  const frag = buildChangelogFragment({ ticket: 2672, section: 'Added', entry: 'New builders.' });
  expect(frag.path).toBe('.changes/unreleased/2672.md');
  expect(frag.content).toBe('### Added\n- New builders.\n');
  expect(() => buildChangelogFragment({ ticket: 2672, section: 'Bogus', entry: 'x' })).toThrow(/section must be/);
});

test('changelog fragment supports multiple entries', () => {
  const frag = buildChangelogFragment({ ticket: 2672, section: 'Fixed', entry: ['one', 'two'] });
  expect(frag.content).toBe('### Fixed\n- one\n- two\n');
});

test('commit trailers derive the signer (never hand-typed) and Refs the ticket', () => {
  const trailers = buildCommitTrailers({ teamModel: TM, role: 'collaborator', ticket: 2672 });
  expect(trailers).toContain(`AI-Signature: ${deriveSigner(TM, 'collaborator')}`);
  expect(trailers).toContain('AI-Team-Model: claude-code:opus@anthropic');
  expect(trailers.startsWith('Refs #2672')).toBe(true);
});

test('invalid ticket is rejected across builders', () => {
  expect(() => buildCommitTrailers({ teamModel: TM, role: 'admin', ticket: 'abc' })).toThrow(/invalid ticket/);
  expect(() => buildChangelogFragment({ ticket: '', section: 'Added', entry: 'x' })).toThrow(/invalid ticket/);
});
