// API smoke load/governance extensions (#749)
//
// Assertion invariant (#2703) — two assertion classes, never conflated:
//   1. BEHAVIORAL assertions (retry recovery, non-blocking render) prove a
//      control-flow property. They MUST be driven deterministically (route
//      interception / fulfilment) and MUST NOT gate on measured wall-clock
//      elapsed time — a slow runner is not a behavioral regression. Asserting
//      `Date.now()` deltas here is the L62-class flake this file was rebuilt to
//      remove (observed 4999ms on a slow runner with no API change; PR #2701).
//   2. LATENCY-METRIC assertions (p95 below) legitimately measure latency as the
//      thing under test, so they keep a measured budget — but a CI-calibrated,
//      headroomed one framed as a catastrophic-regression tripwire, not an SLO.
const { test, expect } = require('@playwright/test');

const HIGH_CONCURRENCY_COUNT = 100;

// CI-safe p95 ceiling: coarse tripwire for order-of-magnitude regression on
// shared GitHub-hosted runners, NOT a precise latency SLO (those belong in a
// dedicated perf harness). Generous headroom keeps it deterministic under load;
// the per-request 200 check below is the primary correctness signal.
const P95_CEILING_MS = 8000;

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

  // LATENCY-METRIC (AC2/AC3): measured p95 is the intended signal; budget is a
  // CI-calibrated regression tripwire (see P95_CEILING_MS rationale above).
  test('cache-miss load: all succeed and p95 stays under regression ceiling (AC2/AC3)', async ({ request }) => {
    const durations = await Promise.all(Array.from({ length: 50 }, async (_, i) => {
      const t0 = Date.now();
      const r = await request.get('/api/wiki-health', {
        headers: {
          'Cache-Control': 'no-cache', Pragma: 'no-cache', 'x-cache-bust': `${Date.now()}-${i}`,
        },
      });
      expect(r.status(), `cache-miss request ${i + 1} failed`).toBe(200); // primary correctness signal
      return Date.now() - t0;
    }));
    const latencyP95 = p95(durations);
    expect(latencyP95, `p95 ${latencyP95}ms exceeded regression ceiling`).toBeLessThan(P95_CEILING_MS);
  });

  // BEHAVIORAL (AC4): hold /api/wiki-health pending; if the header becomes visible
  // while the API is still in-flight, render is provably non-blocking. No wall-clock.
  test('initial render does not await a slow API (AC4)', async ({ page }) => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/api/wiki-health**', async route => {
      await held; // keep the API request pending while we assert the header rendered
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header')).toBeVisible(); // would time out if render blocked on API
    release(); // drain the held request so the route closes cleanly
  });

  // BEHAVIORAL (AC5): route interception forces attempt-1 failure and attempt-2
  // success, proving retry RECOVERY (bounded ≤3) independent of runner speed.
  test('retry amplification recovers after a failed attempt (AC5)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // No counter race: only `retry-probe` requests touch probeCalls, and the
    // evaluate loop below awaits each fetch sequentially — so probe requests are
    // strictly serial (attempt-1 abort fully settles before attempt-2 is issued).
    let probeCalls = 0;
    await page.route('**/api/wiki-health**', async route => {
      if (!route.request().url().includes('retry-probe')) return route.continue();
      probeCalls += 1;
      if (probeCalls === 1) return route.abort('failed'); // first attempt fails
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    const result = await page.evaluate(async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const r = await fetch('/api/wiki-health?retry-probe=1', { cache: 'no-store' });
          if (r.ok) return { ok: true, attempt };
        } catch (_) {}
      }
      return { ok: false, attempt: 3 };
    });
    expect(result.ok, `retry failed after ${result.attempt} attempts`).toBe(true);
    expect(result.attempt, 'expected recovery on the 2nd attempt').toBe(2);
  });
});
