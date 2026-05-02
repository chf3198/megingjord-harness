const { test, expect } = require('@playwright/test');

test.describe('Megingjord Dashboard', () => {
  test('loads with Live view and shows header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Megingjord');
    // Live view is default — baton and activity panels visible
    await expect(page.locator('#panel-baton h2')).toContainText('Agent Baton');
    await expect(page.locator('#panel-activity h2')).toContainText('Live Activity');
  });

  test('view switching shows correct panels', async ({ page }) => {
    await page.goto('/');
    // Switch to Ops via title selector
    await page.click('button[title="Ops"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#panel-quotas h2')).toContainText('Quotas');
    await expect(page.locator('#panel-router h2')).toContainText('Router Lanes');
    // Switch to Fleet
    await page.click('button[title="Fleet"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#panel-devices h2')).toContainText('Devices');
    await expect(page.locator('#panel-services h2')).toContainText('Services');
  });

  test('router panel shows lane content', async ({ page }) => {
    await page.goto('/');
    await page.click('button[title="Ops"]');
    await page.waitForTimeout(500);
    const text = await page.locator('#panel-router').innerText();
    expect(text).toContain('Router');
  });

  test('tooltips toggle via button', async ({ page }) => {
    await page.goto('/');
    await page.click('#btn-tips');
    await page.hover('#btn-refresh');
    await expect(page.locator('#app-tip')).toBeVisible();
  });

  test('help view shows help panel', async ({ page }) => {
    await page.goto('/');
    await page.click('button[title="Help"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#panel-help h2')).toContainText('Help Center');
  });

  test('stress test button exists and is clickable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#btn-test')).toBeVisible();
  });

  test('cost view shows token telemetry content', async ({ page }) => {
    await page.goto('/');
    await page.click('button[title="Cost"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#panel-cost h2')).toContainText('Cost + Token Telemetry');
    await expect(page.locator('#panel-cost')).toContainText('Token Telemetry');
  });
});
