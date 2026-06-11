'use strict';
// tdd-pyramid spec for scripts/global/review-stakes-router.js (#2931 / Epic #2926 C5).
const test = require('node:test');
const assert = require('node:assert');
const { classifyStakes, selectReviewModel, routeReview } = require('../scripts/global/review-stakes-router');

test('AC1: high-stakes paths classify as high (auth/crypto/IAM/gov-gates/deny)', () => {
  for (const p of ['scripts/global/auth-helper.js', 'lib/crypto/keys.js', 'hooks/scripts/pretool_guard.py',
    'scripts/global/fleet-dev-deny-paths.js', 'config/auth-secrets.json', 'src/iam/policy.ts']) {
    assert.strictEqual(classifyStakes({ paths: [p] }), 'high', `${p} should be high-stakes`);
  }
});

test('AC1: closed fail-open gaps — key/encryption/governance/sso/gate classify as high (#2931 review)', () => {
  for (const p of ['scripts/keys.js', 'lib/api-key.js', 'src/encryption-util.js', 'src/governance-policy.ts',
    'auth/sso-handler.js', 'api_gate.go', 'src/keyring.py', 'tls/cert.js', 'auth/jwt.js']) {
    assert.strictEqual(classifyStakes({ paths: [p] }), 'high', `${p} should be high-stakes`);
  }
});

test('AC1: boundary anchoring — non-stakes lookalikes do NOT false-positive', () => {
  // 'gateway' is the fleet LiteLLM gateway (not a governance 'gate'); 'monkey' contains 'key'.
  assert.strictEqual(classifyStakes({ paths: ['scripts/global/litellm-gateway.js'] }), 'standard');
  assert.strictEqual(classifyStakes({ paths: ['src/monkey-patch.js'] }), 'standard');
});

test('AC1: security / area:hooks labels force high', () => {
  assert.strictEqual(classifyStakes({ paths: ['scripts/global/x.js'], labels: ['area:hooks'] }), 'high');
  assert.strictEqual(classifyStakes({ paths: ['scripts/global/x.js'], labels: ['security'] }), 'high');
});

test('AC1: all-docs/tests/config/dashboard paths classify as routine', () => {
  assert.strictEqual(classifyStakes({ paths: ['docs/howto/x.md', 'tests/foo.spec.js', 'config/bar.json'] }), 'routine');
  assert.strictEqual(classifyStakes({ paths: ['dashboard/js/panel.js'] }), 'routine');
});

test('AC1: general code is standard; empty paths default to standard', () => {
  assert.strictEqual(classifyStakes({ paths: ['scripts/global/some-feature.js'] }), 'standard');
  assert.strictEqual(classifyStakes({ paths: [] }), 'standard');
});

test('AC2: tier→model mapping for an anthropic author', () => {
  assert.deepStrictEqual(selectReviewModel({ stakes: 'routine', authorFamily: 'anthropic' }),
    { tier: 'fleet', model: 'qwen2.5-coder:32b', provider: 'ollama', family: 'alibaba', stakes: 'routine', crossFamily: true });
  assert.strictEqual(selectReviewModel({ stakes: 'standard', authorFamily: 'anthropic' }).model, 'gemini-flash');
  assert.strictEqual(selectReviewModel({ stakes: 'high', authorFamily: 'anthropic' }).model, 'gemini-pro');
});

test('AC2: high-stakes never routes to a $0 tier', () => {
  const r = selectReviewModel({ stakes: 'high', authorFamily: 'anthropic' });
  assert.strictEqual(r.tier, 'premium');
  assert.notStrictEqual(r.tier, 'fleet');
  assert.notStrictEqual(r.tier, 'free-cloud');
});

test('AC3: cross-family invariant — google author swaps off gemini to the alternate', () => {
  // standard primary is gemini(google) → collides with a google author → swap to qwen(alibaba).
  assert.strictEqual(selectReviewModel({ stakes: 'standard', authorFamily: 'google' }).family, 'alibaba');
  // high primary is gemini-pro(google) → swap to claude-opus(anthropic) for a google author.
  assert.strictEqual(selectReviewModel({ stakes: 'high', authorFamily: 'google' }).family, 'anthropic');
  // routine primary qwen(alibaba) is already cross-family for a google author.
  assert.strictEqual(selectReviewModel({ stakes: 'routine', authorFamily: 'google' }).family, 'alibaba');
});

test('AC3: reviewer family is never equal to author family across all stakes/authors', () => {
  for (const stakes of ['routine', 'standard', 'high']) {
    for (const authorFamily of ['anthropic', 'google', 'alibaba']) {
      const r = selectReviewModel({ stakes, authorFamily });
      assert.notStrictEqual(r.family, authorFamily, `${stakes}/${authorFamily} must be cross-family`);
      assert.strictEqual(r.crossFamily, true);
    }
  }
});

test('AC4: routeReview classifies + selects; routine→fleet, high→premium', () => {
  assert.strictEqual(routeReview({ paths: ['docs/x.md'], authorFamily: 'anthropic' }).tier, 'fleet');
  assert.strictEqual(routeReview({ paths: ['hooks/scripts/pretool_guard.py'], authorFamily: 'anthropic' }).tier, 'premium');
});
