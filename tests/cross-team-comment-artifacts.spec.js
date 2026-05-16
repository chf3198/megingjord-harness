const { test, expect } = require('@playwright/test');
const A = require('../scripts/global/cross-team-comment-artifacts');

function claim(overrides = {}) {
  return A.block('CLAIM_LEASE', {
    ticket: '#1621',
    team: 'codex',
    role: 'collaborator',
    branch: 'feat/1621-cross-team-artifacts',
    paths: 'scripts/global,tests',
    expires_at: '2026-05-17T00:00:00.000Z',
    ...overrides,
  });
}

test('renders all required artifact types', () => {
  for (const type of Object.keys(A.REQUIRED)) {
    expect(A.block(type, { ticket: '#1' })).toContain(`CROSS_TEAM_${type}`);
  }
});

test('validates a signed claim lease comment', () => {
  const result = A.validate(claim());
  expect(result.ok).toBe(true);
  expect(result.artifact.fields.ticket).toBe('#1621');
});

test('rejects malformed comments and missing ticket refs', () => {
  const result = A.validate('CROSS_TEAM_TEAM_QUESTION\nquestion: hi');
  expect(result.ok).toBe(false);
  expect(result.errors).toContain('missing ticket ref');
});

test('rejects missing signatures', () => {
  const unsigned = claim().replace(/Signed-by:[\s\S]+$/, '');
  expect(A.validate(unsigned).errors).toContain('missing signature');
});

test('rejects duplicate active claims by ticket or branch', () => {
  const active = [{ ticket: '#1621', branch: 'feat/other' }];
  expect(A.validate(claim(), active).errors).toContain('duplicate active claim');
});
