const { test, expect } = require('@playwright/test');

test.describe('DevEnv Ops Dashboard', () => {
  test('loads and shows main panels', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await expect(page.locator('h1')).toContainText('DevEnv Ops');
    await expect(page.locator('#panel-devices h2')).toContainText('Fleet Devices');
    await expect(page.locator('#panel-services h2')).toContainText('Services');
    await expect(page.locator('#panel-quotas h2')).toContainText('Quotas');
    await expect(page.locator('#panel-router h2')).toContainText('Task Router Lanes');
    await page.screenshot({ path: 'test-results/dashboard-home.png', fullPage: true });
  });

  test('router panel shows counts', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    const routerText = await page.locator('#panel-router').innerText();
    expect(routerText.length).toBeGreaterThan(20);
  });
});
