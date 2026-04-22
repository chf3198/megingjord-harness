// Canary test: assert ZERO net:: errors on page load (guards against event-loop blocking)
// Ref: Epic #380 — governance hole that allowed execSync in server handler to break all assets
const { test, expect } = require('@playwright/test');

test.describe('Network integrity on page load', () => {
  test('zero ERR_CONNECTION_RESET or ERR_FAILED on asset load', async ({ page }) => {
    const netErrors = [];
    page.on('requestfailed', req => {
      const err = req.failure()?.errorText || '';
      if (err.includes('ERR_CONNECTION') || err.includes('ERR_FAILED') || err.includes('ECONNRESET')) {
        netErrors.push(`${req.url()} — ${err}`);
      }
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    expect(netErrors, `Network errors detected:\n${netErrors.join('\n')}`).toHaveLength(0);
  });

  test('all CSS and JS assets return 200 under concurrent load', async ({ page }) => {
    const failed = [];
    page.on('response', res => {
      const url = res.url();
      if ((url.includes('/css/') || url.includes('/js/')) && res.status() !== 200) {
        failed.push(`${url} → HTTP ${res.status()}`);
      }
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    expect(failed, `Asset load failures:\n${failed.join('\n')}`).toHaveLength(0);
  });

  test('server responds to concurrent requests without blocking', async ({ request }) => {
    const assets = ['/css/stats.css', '/css/router.css', '/js/health-check.js',
      '/js/app.js', '/js/live-stats.js', '/js/context-flow.js', '/js/alpine.min.js'];
    const t0 = Date.now();
    const results = await Promise.all(assets.map(a => request.get(a)));
    const elapsed = Date.now() - t0;
    results.forEach((r, i) => expect(r.status(), `${assets[i]} failed`).toBe(200));
    expect(elapsed, `Concurrent asset load took ${elapsed}ms (>2000ms = event loop blocked)`).toBeLessThan(2000);
  });
});
