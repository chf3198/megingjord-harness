const { test, expect } = require('@playwright/test');

test.describe('Google quality checks', () => {
  test.use({ viewport: { width: 960, height: 1080 } });

  test('devtools metrics and memory budget snapshot', async ({ page, context }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.waitForTimeout(2500);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const map = Object.fromEntries(metrics.map(m => [m.name, m.value]));
    expect(map.Timestamp).toBeGreaterThan(0);
    expect(map.ScriptDuration).toBeLessThan(3);

    const mem = await page.evaluate(() => {
      const m = performance.memory;
      if (!m) return null;
      return Math.round((m.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
    });
    if (mem != null) expect(mem).toBeLessThan(50);
  });

  test('core UX controls are functional', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.click('#btn-auto');
    await expect(page.locator('#btn-auto')).toHaveAttribute('aria-pressed', 'false');
    await page.click('#btn-contrast');
    await expect(page.locator('body')).toHaveClass(/high-contrast/);
    await page.click('#btn-contrast');
    await page.click('button:has-text("Resources")');
    await expect(page.locator('#panel-services')).toBeVisible();
  });
});
