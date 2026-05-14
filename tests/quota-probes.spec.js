// Unit tests for the parseGroqHeaders extraction in scripts/quota-probes.js (#1549).
// Refactor decomposed probeGroq by extracting parseGroqHeaders(headers); this spec
// pins the mapping contract so a regression in the extracted helper is caught fast.
const { test, expect } = require('@playwright/test');
const path = require('path');
const QP = require(path.resolve(__dirname, '..', 'scripts', 'quota-probes.js'));

test('quota-probes exports retain the public surface after refactor', () => {
  expect(typeof QP.probeGroq).toBe('function');
  expect(typeof QP.probeGoogle).toBe('function');
  expect(typeof QP.probeCerebras).toBe('function');
  expect(typeof QP.probeAll).toBe('function');
  expect(typeof QP.parseGroqHeaders).toBe('function');
});

test('parseGroqHeaders maps every x-ratelimit-* header into the normalized dashboard shape', () => {
  const headers = {
    'x-ratelimit-limit-requests': '14400',
    'x-ratelimit-remaining-requests': '14399',
    'x-ratelimit-limit-tokens': '500000',
    'x-ratelimit-remaining-tokens': '499873',
    'x-ratelimit-reset-requests': '6s',
    'x-ratelimit-reset-tokens': '12ms',
  };
  expect(QP.parseGroqHeaders(headers)).toEqual({
    id: 'groq',
    limitReqs: 14400,
    remainReqs: 14399,
    limitTokens: 500000,
    remainTokens: 499873,
    resetReqs: '6s',
    resetTokens: '12ms',
  });
});

test('parseGroqHeaders coerces missing numeric headers to 0 and missing reset windows to empty string', () => {
  expect(QP.parseGroqHeaders({})).toEqual({
    id: 'groq',
    limitReqs: 0,
    remainReqs: 0,
    limitTokens: 0,
    remainTokens: 0,
    resetReqs: '',
    resetTokens: '',
  });
});

test('parseGroqHeaders preserves the +-coercion semantics inherited from the pre-refactor inline construction', () => {
  const headers = {
    'x-ratelimit-limit-requests': '0',
    'x-ratelimit-remaining-tokens': '',
    'x-ratelimit-limit-tokens': '42',
    'x-ratelimit-reset-requests': '0s',
  };
  const parsed = QP.parseGroqHeaders(headers);
  expect(parsed.limitReqs).toBe(0);
  expect(parsed.remainTokens).toBe(0);
  expect(parsed.limitTokens).toBe(42);
  expect(parsed.resetReqs).toBe('0s');
  expect(parsed.resetTokens).toBe('');
});
