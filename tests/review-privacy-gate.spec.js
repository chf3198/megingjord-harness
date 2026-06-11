'use strict';
// tdd-pyramid spec for scripts/global/review-privacy-gate.js (#2934 / Epic #2926 C8).
const test = require('node:test');
const assert = require('node:assert');
const G = require('../scripts/global/review-privacy-gate');

const fakeRedact = { redactString: (s) => ({ text: s.replace(/secret-\w+/g, '<REDACTED>'), hits: [{ id: 'x' }] }) };

test('AC1: fleet is local; free-cloud + premium are external', () => {
  assert.strictEqual(G.isExternalTier('fleet'), false);
  assert.strictEqual(G.isExternalTier('free-cloud'), true);
  assert.strictEqual(G.isExternalTier('premium'), true);
});

test('AC2: fleet is always allowed without redaction (diff never leaves the host)', () => {
  const g = G.gateExternalDispatch({ tier: 'fleet', sensitive: true, env: { MEGINGJORD_REVIEW_NO_EXTERNAL: '1' } });
  assert.deepStrictEqual({ allowed: g.allowed, redact: g.requiresRedaction }, { allowed: true, redact: false });
});

test('AC2: external + unrestricted ⇒ allowed but requires redaction', () => {
  const g = G.gateExternalDispatch({ tier: 'free-cloud', env: {} });
  assert.strictEqual(g.allowed, true);
  assert.strictEqual(g.requiresRedaction, true);
});

test('AC2: NO_EXTERNAL/sensitive ⇒ free-cloud BLOCKED with fleet-or-dpop redirect', () => {
  const viaEnv = G.gateExternalDispatch({ tier: 'free-cloud', env: { MEGINGJORD_REVIEW_NO_EXTERNAL: '1' } });
  assert.strictEqual(viaEnv.allowed, false);
  assert.strictEqual(viaEnv.redirect, 'fleet-only-or-dpop-premium');
  const viaFlag = G.gateExternalDispatch({ tier: 'free-cloud', sensitive: true, env: {} });
  assert.strictEqual(viaFlag.allowed, false);
});

test('AC2: premium under restriction is allowed (DPoP-contracted) but still redacted', () => {
  const g = G.gateExternalDispatch({ tier: 'premium', sensitive: true, env: {} });
  assert.strictEqual(g.allowed, true);
  assert.strictEqual(g.requiresRedaction, true);
  assert.strictEqual(g.reason, 'dpop-premium-contracted');
});

test('AC3: redactForExternal applies log-redaction; prepare redacts external payloads only', () => {
  const fleet = G.prepareReviewDispatch({ diff: 'secret-abc here', tier: 'fleet' }, fakeRedact);
  assert.strictEqual(fleet.payload, 'secret-abc here', 'fleet payload is NOT redacted (local)');
  const ext = G.prepareReviewDispatch({ diff: 'secret-abc here', tier: 'free-cloud', env: {} }, fakeRedact);
  assert.strictEqual(ext.payload, '<REDACTED> here', 'external payload IS redacted');
  assert.ok(ext.redactionHits.length >= 1);
});

test('AC4 metric: sensitive/NO_EXTERNAL free-cloud dispatch yields NO payload (external-on-sensitive = 0)', () => {
  const blocked = G.prepareReviewDispatch({ diff: 'secret-abc', tier: 'free-cloud', sensitive: true }, fakeRedact);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.payload, null, 'no payload ever leaves for a blocked sensitive free-cloud dispatch');
  assert.strictEqual(blocked.redirect, 'fleet-only-or-dpop-premium');
});

test('AC3: null/undefined diff is handled without throwing', () => {
  assert.strictEqual(G.prepareReviewDispatch({ diff: null, tier: 'fleet' }).payload, 'null');
  assert.doesNotThrow(() => G.redactForExternal(undefined, fakeRedact));
});
