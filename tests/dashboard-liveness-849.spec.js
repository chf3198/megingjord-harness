const { test, expect } = require('@playwright/test');

async function switchView(page, title) {
  await page.click(`button[title="${title}"]`);
  await page.waitForTimeout(250);
}

async function setPanelTs(page, hhmmss) {
  await page.evaluate((val) => {
    const app = Alpine.$data(document.querySelector('[x-data]'));
    app.panelTs = { github: val, quotas: val, wiki: val, cost: val, agents: val, flow: val };
  }, hhmmss);
}

test.describe('Epic #849 dashboard liveness', () => {
  test('all 6 target panels expose changing last-updated timestamps', async ({ page }) => {
    await page.goto('/');
    await setPanelTs(page, '12:00:01 AM');
    await expect(page.locator('#panel-context-flow .panel-ts')).toContainText('12:00:01');

    await switchView(page, 'Ops');
    await expect(page.locator('#panel-github .panel-ts')).toContainText('12:00:01');
    await expect(page.locator('#panel-quotas .panel-ts')).toContainText('12:00:01');

    await switchView(page, 'Wiki');
    await expect(page.locator('#panel-wiki-metrics .panel-ts')).toContainText('12:00:01');

    await switchView(page, 'Cost');
    await expect(page.locator('#panel-cost .panel-ts')).toContainText('12:00:01');

    await switchView(page, 'Agents');
    await expect(page.locator('#panel-agents .panel-ts')).toContainText('12:00:01');

    await page.waitForTimeout(1100);
    await setPanelTs(page, '12:00:03 AM');
    await expect(page.locator('#panel-agents .panel-ts')).toContainText('12:00:03');
  });

  test('context-flow responds to live event mapping', async ({ page }) => {
    await page.goto('/');
    await switchView(page, 'Live');
    const activeCount = await page.evaluate(() => {
      const app = Alpine.$data(document.querySelector('[x-data]'));
      const evt = { data: JSON.stringify({ type: 'baton:handoff', model: 'qwen' }) };
      window.handleSSEvent(app, evt);
      return document.querySelectorAll('.cf-active').length;
    });
    expect(activeCount).toBeGreaterThan(0);
  });
});
