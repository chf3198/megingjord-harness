// Layout regression tests — Context Flow and Baton (#399)
// Asserts geometric invariants that caught clipping/overlap regressions in UAT.
const { test, expect } = require('@playwright/test');

const BATON_STUB = {
  tickets: [{
    issue: 42, title: 'Layout test ticket', status: 'in-progress',
    agent: 'Claude Harper', model: 'claude-sonnet-4-6',
    steps: [
      { id: 'manager',      label: 'Manager',      done: true },
      { id: 'collaborator', label: 'Collaborator', active: true },
    ],
  }],
};

async function goLive(page) {
  await page.route('**/api/baton', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BATON_STUB) })
  );
  await page.goto('/');
  const btn = page.locator('button[title="Live"]');
  if (await btn.count() > 0) await btn.click();
  await page.waitForTimeout(400);
}

test.describe('Layout regression — baton and activity panels', () => {
  test('baton-panel and activity-panel are side-by-side at 725px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 725, height: 1080 });
    await goLive(page);
    const batonBox    = await page.locator('#panel-baton').boundingBox();
    const activityBox = await page.locator('#panel-activity').boundingBox();
    expect(batonBox).not.toBeNull();
    expect(activityBox).not.toBeNull();
    const leftDiff = Math.abs(activityBox.x - batonBox.x);
    expect(leftDiff).toBeGreaterThanOrEqual(10);
  });
});

test.describe('Layout regression — context flow panel', () => {
  test('cf-panel bottom edge does not exceed viewport height', async ({ page }) => {
    await goLive(page);
    const panelBox      = await page.locator('#panel-context-flow').boundingBox();
    const viewportHeight = page.viewportSize().height;
    expect(panelBox).not.toBeNull();
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(viewportHeight + 1);
  });

  test('every cf-sub label Y is within its parent cf-node-g rect bounds', async ({ page }) => {
    await goLive(page);
    await page.locator('.cf-svg').waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    const violations = await page.evaluate(() => {
      const groups = [...document.querySelectorAll('.cf-node-g')];
      if (!groups.length) return [];
      return groups.flatMap(g => {
        const rect   = g.querySelector('rect');
        const labels = [...g.querySelectorAll('.cf-sub')];
        if (!rect || !labels.length) return [];
        const rectY = parseFloat(rect.getAttribute('y') || '0');
        const rectH = parseFloat(rect.getAttribute('height') || '0');
        return labels
          .filter(lbl => {
            const ly = parseFloat(lbl.getAttribute('y') || '0');
            return ly < rectY - 2 || ly > rectY + rectH + 2;
          })
          .map(lbl => ({ y: lbl.getAttribute('y'), rectY, rectH }));
      });
    });
    expect(violations).toHaveLength(0);
  });

  test('every cf-node-g rect left edge is >= 5px from cf-panel left border', async ({ page }) => {
    await goLive(page);
    await page.locator('.cf-svg').waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    const panelBox = await page.locator('#panel-context-flow').boundingBox();
    expect(panelBox).not.toBeNull();
    const violations = await page.evaluate((panelLeft) => {
      const rects = [...document.querySelectorAll('.cf-node-g rect')];
      if (!rects.length) return [];
      return rects
        .filter(r => r.getBoundingClientRect().left < panelLeft + 5)
        .map(r => ({ left: r.getBoundingClientRect().left, panelLeft }));
    }, panelBox.x);
    expect(violations).toHaveLength(0);
  });
});
