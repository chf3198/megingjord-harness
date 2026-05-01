// API smoke tests — critical endpoint health and concurrency gate (#713 / epic #380)
const { test, expect } = require('@playwright/test');

const CRITICAL_ENDPOINTS = [
  '/api/wiki-health',
  '/api/wiki-pages',
  '/api/wiki-metrics',
  '/api/host-info',
  '/api/router/metrics',
  '/api/events',
  '/api/fleet-health',
  '/api/copilot-usage',
];
const CONCURRENT_THRESHOLD_MS = 3000;
const SEQUENTIAL_THRESHOLD_MS = 3000;
const RAPID_REQUEST_COUNT = 3;

test.describe('API smoke — critical endpoint health (#713)', () => {
  test('each critical endpoint returns HTTP 200 with JSON content-type', async ({ request }) => {
    for (const endpoint of CRITICAL_ENDPOINTS) {
      const response = await request.get(endpoint);
      expect(response.status(), `${endpoint} returned non-200`).toBe(200);
      expect(
        response.headers()['content-type'],
        `${endpoint} did not return JSON`
      ).toContain('application/json');
    }
  });

  test('all 8 critical endpoints respond concurrently within 3000ms', async ({ request }) => {
    const startMs = Date.now();
    const responses = await Promise.all(
      CRITICAL_ENDPOINTS.map(endpoint => request.get(endpoint))
    );
    const elapsedMs = Date.now() - startMs;
    responses.forEach((response, index) => {
      expect(
        response.status(),
        `${CRITICAL_ENDPOINTS[index]} failed under concurrent load`
      ).toBe(200);
    });
    expect(
      elapsedMs,
      `Concurrent API load took ${elapsedMs}ms — event loop may be blocked`
    ).toBeLessThan(CONCURRENT_THRESHOLD_MS);
  });

  test('3 rapid sequential requests to /api/wiki-health return 200 without blocking', async ({ request }) => {
    const startMs = Date.now();
    for (let requestNum = 0; requestNum < RAPID_REQUEST_COUNT; requestNum++) {
      const response = await request.get('/api/wiki-health');
      expect(response.status(), `wiki-health request ${requestNum + 1} failed`).toBe(200);
    }
    const elapsedMs = Date.now() - startMs;
    expect(
      elapsedMs,
      `3 sequential wiki-health requests took ${elapsedMs}ms (>3000ms = blocking)`
    ).toBeLessThan(SEQUENTIAL_THRESHOLD_MS);
  });
});
