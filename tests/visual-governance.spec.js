const { test, expect } = require('@playwright/test');

const BATON_STUB = {
  tickets: [{
    issue: 42, title: 'Test ticket', status: 'in-progress',
    agent: 'Clio Harper', model: 'claude-sonnet-4-6',
    steps: [{ id: 'manager', label: 'Manager', done: true },
            { id: 'collaborator', label: 'Collaborator', active: true }],
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

test.describe('Visual governance — baton rows', () => {
  test('rows have positive height (not clipped)', async ({ page }) => {
    await goLive(page);
    const rows = page.locator('.baton-row');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const box = await rows.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThan(0);
      expect(box.width).toBeGreaterThan(0);
    }
  });

  test('rows are within viewport bounds', async ({ page }) => {
    await goLive(page);
    const rows = page.locator('.baton-row');
    const count = await rows.count();
    const vp = page.viewportSize();
    for (let i = 0; i < count; i++) {
      const box = await rows.nth(i).boundingBox();
      if (!box) continue;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    }
  });
});

test.describe('Visual governance — context flow layout', () => {
  test('SVG renders with positive dimensions', async ({ page }) => {
    await goLive(page);
    const svg = page.locator('.cf-svg');
    await expect(svg).toBeVisible();
    const box = await svg.boundingBox();
    expect(box.width).toBeGreaterThan(100);
    expect(box.height).toBeGreaterThan(50);
  });

  test('node rects are ≥5px inside SVG viewBox border', async ({ page }) => {
    await goLive(page);
    const rects = await page.locator('.cf-svg .cf-node-g rect').evaluateAll(ns =>
      ns.map(n => ({
        x: parseFloat(n.getAttribute('x') || '0'),
        y: parseFloat(n.getAttribute('y') || '0'),
        w: parseFloat(n.getAttribute('width') || '0'),
        h: parseFloat(n.getAttribute('height') || '0'),
      }))
    );
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(5);
      expect(r.y).toBeGreaterThanOrEqual(5);
      expect(r.x + r.w).toBeLessThanOrEqual(620);
      expect(r.y + r.h).toBeLessThanOrEqual(260);
    }
  });

  test('cf-sub labels are within parent node rect Y range', async ({ page }) => {
    await goLive(page);
    const groups = await page.locator('.cf-svg').evaluateHandle(svg => {
      return [...svg.querySelectorAll('.cf-node-g')].map(g => {
        const rect = g.querySelector('rect');
        const rectY = parseFloat(rect?.getAttribute('y') || '0');
        const rectH = parseFloat(rect?.getAttribute('height') || '0');
        const subYs = [...g.querySelectorAll('.cf-sub')].map(s => parseFloat(s.getAttribute('y') || '0'));
        return { rectY, rectH, subYs };
      });
    });
    for (const g of await groups.jsonValue()) {
      for (const sy of g.subYs) {
        expect(sy).toBeGreaterThanOrEqual(g.rectY - 2);
        expect(sy).toBeLessThanOrEqual(g.rectY + g.rectH + 2);
      }
    }
  });
});
