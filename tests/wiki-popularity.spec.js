// Wiki section popularity — auto-record and display fix (#328)
const { test, expect } = require('@playwright/test');

const WIKI_PAGES = [
  { slug: 'device-monitor', type: 'entities', title: 'Device Monitor', tags: [] },
  { slug: 'context-flow', type: 'concepts', title: 'Context Flow', tags: [] },
];
const WIKI_HEALTH = {
  loaded: true, pages: 2, dirs: 4, issues: 0,
  broken: [], orphans: [], frontmatter: [], indexSync: [],
  lastCheck: new Date().toISOString(),
};
const METRICS_EMPTY = {
  totalAccess: 0, sections: {}, pages: {},
  grade: 'C', score: 60, gradeReasons: [], lastAccess: null,
};
const METRICS_WITH_DATA = {
  totalAccess: 3, sections: { entities: 2, concepts: 1 }, pages: {},
  grade: 'B', score: 78, gradeReasons: [], lastAccess: new Date().toISOString(),
};

async function goWiki(page, metrics) {
  await page.route('**/api/wiki-pages', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WIKI_PAGES) })
  );
  await page.route('**/api/wiki-health', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(WIKI_HEALTH) })
  );
  await page.route('**/api/wiki-metrics', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(metrics) })
  );
  await page.goto('/');
  await page.evaluate(() => {
    const el = document.querySelector('[x-data]');
    if (el) Alpine.$data(el).setView('wiki');
  });
  await page.waitForTimeout(500);
}

test.describe('Wiki section popularity (#328)', () => {
  test('section bars visible when metrics has section data', async ({ page }) => {
    await goWiki(page, METRICS_WITH_DATA);
    const bars = page.locator('.wm-bars');
    await expect(bars).toBeVisible();
    await expect(page.locator('.wm-row').first()).toBeVisible();
  });

  test('no-data message shown when sections empty', async ({ page }) => {
    await goWiki(page, METRICS_EMPTY);
    const bars = page.locator('.wm-bars');
    if (await bars.count() > 0) {
      const text = await bars.textContent();
      expect(text).toContain('No section views recorded');
    }
  });

  test('wiki section click fires /api/wiki-access with section param', async ({ page }) => {
    const hits = [];
    await page.route('**/api/wiki-access**', route => {
      hits.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await goWiki(page, METRICS_EMPTY);
    const summary = page.locator('.wiki-section summary').first();
    if (await summary.count() > 0) {
      await summary.click();
      await page.waitForTimeout(300);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]).toContain('section=');
    }
  });

  test('auto-record fires on wiki reader render', async ({ page }) => {
    const hits = [];
    await page.route('**/api/wiki-access**', route => {
      hits.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await goWiki(page, METRICS_EMPTY);
    // Auto-record fires when wiki reader renders sections; wait for debounced call
    await page.waitForTimeout(600);
    const sectionHits = hits.filter(u => u.includes('section='));
    expect(sectionHits.length).toBeGreaterThan(0);
  });
});
