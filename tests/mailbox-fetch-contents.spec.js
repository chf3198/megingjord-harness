// /mcp mailbox:read fetch_contents tests (#942).
const { test, expect } = require('@playwright/test');

const BASE = 'https://hamr.chf3198.workers.dev';

test('/mcp mailbox:read auth-before-dispatch ordering preserved', async ({ request }) => {
  const r = await request.post(`${BASE}/mcp`, {
    data: { capability: 'mailbox:read', params: { fetch_contents: true } },
  });
  // Auth fires before dispatch; bare POST → 401
  expect(r.status()).toBe(401);
});

test('/mcp mailbox:read with bogus key + fetch_contents still 401s', async ({ request }) => {
  const r = await request.post(`${BASE}/mcp`, {
    data: { capability: 'mailbox:read', params: { fetch_contents: true, limit: 5 } },
    headers: {
      authorization: 'DPoP test',
      'x-hamr-signature': 'sig', 'x-hamr-key-id': 'bogus', 'x-hamr-canonical': 'c',
    },
  });
  expect(r.status()).toBe(401);
  const body = await r.json();
  expect(['unknown_key_id', 'no_publisher_keyring_configured']).toContain(body.reason);
});

test('/mcp default mailbox:read (no fetch_contents) still returns keys-only shape', async ({ request }) => {
  const r = await request.post(`${BASE}/mcp`, {
    data: { capability: 'mailbox:read' },
    headers: {
      authorization: 'DPoP test',
      'x-hamr-signature': 'sig', 'x-hamr-key-id': 'bogus', 'x-hamr-canonical': 'c',
    },
  });
  // Auth-first ordering: 401 before reaching dispatch
  expect(r.status()).toBe(401);
});
