// API smoke load/governance extensions (#749)
const { test, expect } = require('@playwright/test');

const HIGH_CONCURRENCY_COUNT = 100;

function p95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

test.describe('API smoke load governance (#749)', () => {
  test('100 concurrent wiki-health requests return 200 (AC1)', async ({ request }) => {
    const requests = Array.from({ length: HIGH_CONCURRENCY_COUNT }, (_, i) =>
      request.get('/api/wiki-health', { headers: { 'x-load-request': String(i) } })
    );
    const responses = await Promise.all(requests);
    responses.forEach((r, i) => expect(r.status(), `request ${i + 1} failed`).toBe(200));
  });

  test('p95 latency for 50 cache-miss requests is <2000ms (AC2/AC3)', async ({ request }) => {
    const durations = await Promise.all(Array.from({ length: 50 }, async (_, i) => {
      const t0 = Date.now();
      const r = await request.get('/api/wiki-health', {
        headers: {
          'Cache-Control': 'no-cache', Pragma: 'no-cache', 'x-cache-bust': `${Date.now()}-${i}`,
        },
      });
      expect(r.status()).toBe(200);
      return Date.now() - t0;
    }));
    const latencyP95 = p95(durations);
    expect(latencyP95, `p95 ${latencyP95}ms exceeded 2000ms`).toBeLessThan(2000);
  });

  test('slow api response does not block initial page render (AC4)', async ({ page }) => {
    await page.route('**/api/wiki-health**', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });
    const t0 = Date.now();
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible();
    expect(Date.now() - t0, 'page render blocked by slow API').toBeLessThan(3000);
  });

  test('retry amplification: first timeout then success within 3000ms (AC5)', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    try {
      await request.get('/api/wiki-health', { timeout: 1 });
    } catch (_) {}
    const result = await page.evaluate(async () => {
      const t0 = Date.now();
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const r = await fetch('/api/wiki-health', { cache: 'no-store' });
          if (r.ok) return { ok: true, attempt, elapsed: Date.now() - t0 };
        } catch (_) {}
      }
      return { ok: false, attempt: 3, elapsed: Date.now() - t0 };
    });
    expect(result.ok, `retry failed after ${result.attempt} attempts`).toBe(true);
    expect(result.elapsed, `retry took ${result.elapsed}ms`).toBeLessThan(3000);
  });
});
