const { test, expect } = require('@playwright/test');

test.describe('DevEnv Ops Dashboard', () => {
  test.use({ viewport: { width: 960, height: 1080 } });

  test('loads and shows main panels', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await expect(page.locator('h1')).toContainText('DevEnv Ops');
    await page.click('button:has-text("Resources")');
    await expect(page.locator('#panel-devices h2')).toContainText('Fleet Devices');
    await expect(page.locator('#panel-services h2')).toContainText('Services');
    await page.click('button:has-text("Ops")');
    await expect(page.locator('#panel-quotas h2')).toContainText('Quotas');
    await expect(page.locator('#panel-router h2')).toContainText('Task Router Lanes');
    await page.screenshot({ path: 'test-results/dashboard-home.png', fullPage: true });
  });

  test('router panel shows counts', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    const routerText = await page.locator('#panel-router').innerText();
    expect(routerText.length).toBeGreaterThan(20);
  });

  test('tooltips and help view work', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.click('#btn-tips');
    await page.hover('#btn-refresh');
    await expect(page.locator('#app-tip')).toContainText('More info');
    await page.click('button:has-text("Help")');
    await expect(page.locator('#panel-help')).toContainText('Half-screen target');
  });

  test('quick stress test starts and updates status', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.click('#btn-test');
    await expect(page.locator('#panel-test')).toContainText('round 1/12');
  });
});
