const { test, expect } = require('@playwright/test');

test.describe('Google quality checks', () => {
  test('CDP performance metrics within budget', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForTimeout(2500);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const map = Object.fromEntries(metrics.map(m => [m.name, m.value]));
    expect(map.ScriptDuration).toBeLessThan(3);
    expect(map.TaskDuration).toBeLessThan(5);
    // Nodes metric is cumulative per-process — skip in CI
    expect(map.LayoutCount).toBeLessThan(50);
  });

  test('JS heap memory under 50 MB via CDP', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.click('button[title="Ops"]');
    await page.waitForTimeout(500);
    await page.click('button[title="Help"]');
    await page.waitForTimeout(500);
    await page.click('button[title="Fleet"]');
    await page.waitForTimeout(500);
    const cdp = await context.newCDPSession(page);
    const heap = await cdp.send('Runtime.getHeapUsage');
    const heapMB = heap.usedSize / (1024 * 1024);
    expect(heapMB).toBeLessThan(50);
    expect(heapMB).toBeGreaterThan(0);
  });

  test('x-if removes inactive view panels from DOM', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    // Live view default — baton and activity panels visible
    await expect(page.locator('#panel-baton')).toBeVisible();
    await expect(page.locator('#panel-activity')).toBeVisible();
    // Fleet panels should not exist (x-if removes them)
    const devicesCount = await page.locator('#panel-devices').count();
    expect(devicesCount).toBe(0);
    // Switch to Fleet — fleet panels appear
    await page.click('button[title="Fleet"]');
    await page.waitForTimeout(500);
    await expect(page.locator('#panel-devices')).toBeVisible();
    // Live panels removed by x-if
    const batonCount = await page.locator('#panel-baton').count();
    expect(batonCount).toBe(0);
  });

  test('core UX controls are functional', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-auto');
    await expect(page.locator('#btn-auto')).toHaveAttribute('aria-pressed', 'false');
    await page.click('#btn-contrast');
    await expect(page.locator('body')).toHaveClass(/high-contrast/);
    await page.click('#btn-contrast');
  });
});
