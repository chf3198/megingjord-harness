const { test, expect } = require('@playwright/test');

test.describe('DevEnv Ops Dashboard', () => {
  test.use({ viewport: { width: 960, height: 1080 } });

  test('loads and shows main panels via view switching', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await expect(page.locator('h1')).toContainText('DevEnv Ops');
    // Fleet view active by default — check Fleet panels visible
    await expect(page.locator('#panel-topology h2')).toContainText('Fleet Topology');
    await expect(page.locator('#panel-baton h2')).toContainText('Agent Baton');
    // Switch to Ops view
    await page.click('button:has-text("Ops")');
    await expect(page.locator('#panel-quotas h2')).toContainText('Quotas');
    await expect(page.locator('#panel-router h2')).toContainText('Task Router Lanes');
    // Switch to Resources — panels inserted via x-if
    await page.click('button:has-text("Resources")');
    await expect(page.locator('#panel-devices h2')).toContainText('Fleet Devices');
    await expect(page.locator('#panel-services h2')).toContainText('Services');
    await page.screenshot({ path: 'test-results/dashboard-home.png', fullPage: true });
  });

  test('router panel shows lane content', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.click('button:has-text("Ops")');
    await page.waitForTimeout(500);
    const routerText = await page.locator('#panel-router').innerText();
    expect(routerText).toContain('Free');
    expect(routerText).toContain('Fleet');
    expect(routerText).toContain('Premium');
  });

  test('tooltips use Alpine reactive state', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.click('#btn-tips');
    await page.hover('#btn-refresh');
    await expect(page.locator('#app-tip')).toBeVisible();
    await expect(page.locator('#app-tip')).toContainText('Help:');
    // Switch to Help view — panel should show searchable help sections + dev toggle
    await page.click('button:has-text("Help")');
    await expect(page.locator('#panel-help')).toContainText('Fleet Topology');
    await expect(page.locator('.help-toggle')).toBeVisible();
  });

  test('quick stress test starts and updates status', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    await page.click('#btn-test');
    await expect(page.locator('#panel-test')).toContainText('Round');
  });
});
