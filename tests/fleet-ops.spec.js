const { test, expect } = require('@playwright/test');

test.describe('Fleet Operations Center', () => {
  test('fleet view shows device and service panels', async ({ page }) => {
    await page.goto('/');
    await page.click('button[title="Fleet"]');
    await page.waitForTimeout(500);
    await expect(page.locator('#panel-devices h2')).toContainText('Devices');
    await expect(page.locator('#panel-services h2')).toContainText('Services');
  });

  test('fleet health is in logs view', async ({ page }) => {
    await page.goto('/');
    await page.click('button[title="Logs"]');
    await page.waitForTimeout(500);
    await expect(page.locator('#panel-fleet-health-log h2')).toContainText('Fleet Health');
  });

  test('agent baton flow shows on live view', async ({ page }) => {
    await page.goto('/');
    // Live is default view
    const baton = page.locator('#panel-baton');
    await expect(baton).toBeVisible();
    await expect(baton).toContainText('Agent Baton');
  });

  test('fleet panels use grid layout', async ({ page }) => {
    await page.goto('/');
    await page.click('button[title="Fleet"]');
    await page.waitForTimeout(500);
    const devices = page.locator('#panel-devices');
    const box = await devices.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThan(100);
  });

  test('view switching preserves panel state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#panel-baton')).toBeVisible();
    await page.click('button[title="Ops"]');
    await page.waitForTimeout(300);
    await page.click('button[title="Live"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#panel-baton')).toBeVisible();
    await expect(page.locator('#panel-activity')).toBeVisible();
  });

  test('service cards include dashboard links', async ({ page }) => {
    await page.goto('/');
    await page.click('button[title="Fleet"]');
    await page.waitForTimeout(500);
    const links = await page.locator('.svc-link').count();
    expect(links).toBeGreaterThanOrEqual(1);
  });

  test('settings panel shows fleet resources', async ({ page }) => {
    await page.goto('/');
    await page.click('button[title="Fleet"]');
    await page.waitForTimeout(500);
    await expect(page.locator('#panel-settings h2')).toContainText('Fleet Resources');
  });
});
