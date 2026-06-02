// #2613 — governance-bundle producer-push (operationalizes #2094).
'use strict';
const { test, expect } = require('@playwright/test');
const crypto = require('node:crypto');
const path = require('path');
const P = require(path.resolve(__dirname, '..', 'scripts', 'global', 'governance-bundle-push.js'));

const FIELDS = {
  checks_run: '15/16', checks_failed: 1, drift_score: '8/10',
  fleet_utilization: '1/2', rubric_rating: '9/10', wiki_health: '163→163',
  extra_secret: 'sk-ant-LEAK', // must be dropped by the bundle allow-list (G4)
};

test('graceful no-op: no issue / no fields snapshot (G6)', async () => {
  expect((await P.pushBundle({})).reason).toBe('no_issue');
  expect((await P.pushBundle({ issue: 999999321 })).reason).toBe('no_fields_snapshot');
});

test('builds + signs + POSTs the bundle to /governance-bundle; allow-list enforced', async () => {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  let captured = null;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return { ok: true, status: 200, json: async () => ({ stored: true }) };
  };
  const r = await P.pushBundle({ issue: 2094, fields: FIELDS, key: privateKey, fetchImpl, nowMs: 1_700_000_000_000, url: 'https://hamr.test' });
  expect(r.ok).toBe(true);
  expect(r.content_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(captured.url).toBe('https://hamr.test/governance-bundle');
  expect(captured.init.method).toBe('POST');
  expect(captured.init.headers['x-hamr-signature']).toBeTruthy();
  const body = JSON.parse(captured.init.body);
  expect(body.content_hash).toBe(r.content_hash);
  expect(body.fields.extra_secret).toBeUndefined();        // allow-list dropped it (G4)
  expect(body.fields.rubric_rating).toBe('9/10');           // mandatory field carried
  // signature verifies against the canonical body with the operator public key
  const canonical = JSON.stringify(body);
  const ok = crypto.verify(null, Buffer.from(canonical), crypto.createPublicKey(privateKey),
    Buffer.from(captured.init.headers['x-hamr-signature'], 'base64'));
  expect(ok).toBe(true);
});
