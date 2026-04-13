const { test, expect } = require('@playwright/test');

test.describe('Google quality checks', () => {
  test.use({ viewport: { width: 960, height: 1080 } });

  test('CDP performance metrics within budget', async ({ page, context }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.waitForTimeout(2500);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const map = Object.fromEntries(metrics.map(m => [m.name, m.value]));

    // Script execution budget: <3s total CPU time
    expect(map.ScriptDuration).toBeLessThan(3);
    // Task duration budget: <5s total main-thread time
    expect(map.TaskDuration).toBeLessThan(5);
    // DOM node budget: Lighthouse warns at 800, fails 1400
    expect(map.Nodes).toBeLessThan(800);
    // Layout recalcs should be minimal on initial load
    expect(map.LayoutCount).toBeLessThan(50);
  });

  test('JS heap memory under 50 MB via CDP', async ({ page, context }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.waitForTimeout(2000);
    // Switch through all views to exercise DOM creation/destruction
    await page.click('button:has-text("Resources")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Help")');
    await page.waitForTimeout(500);
    await page.click('button:has-text("Ops")');
    await page.waitForTimeout(500);
    const cdp = await context.newCDPSession(page);
    const heap = await cdp.send('Runtime.getHeapUsage');
    const heapMB = heap.usedSize / (1024 * 1024);
    expect(heapMB).toBeLessThan(50);
    expect(heapMB).toBeGreaterThan(0);
  });

  test('x-if removes inactive view panels from DOM', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.waitForTimeout(1000);
    // On Ops view, Resources panels should not exist (x-if removes them)
    const devicesCount = await page.locator('#panel-devices').count();
    expect(devicesCount).toBe(0);
    // Ops panels use x-show (present but hidden when inactive)
    await expect(page.locator('#panel-quotas')).toBeVisible();
    // Switch to Resources — Resources panels appear, ops panels hidden
    await page.click('button:has-text("Resources")');
    await page.waitForTimeout(500);
    await expect(page.locator('#panel-devices')).toBeVisible();
    await expect(page.locator('#panel-quotas')).toBeHidden();
    // Help panel should not exist (x-if)
    const helpCount = await page.locator('#panel-help').count();
    expect(helpCount).toBe(0);
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
