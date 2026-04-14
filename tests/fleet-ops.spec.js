const { test, expect } = require('@playwright/test');

test.describe('Fleet Operations Center', () => {
  test.use({ viewport: { width: 960, height: 1080 } });

  test('fleet topology renders SVG with device nodes', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    const svg = page.locator('#panel-topology .topo-svg');
    await expect(svg).toBeVisible();
    // Should have device nodes (circles)
    const nodes = await svg.locator('.topo-node').count();
    expect(nodes).toBeGreaterThanOrEqual(1);
    // Should have labels
    const labels = await svg.locator('.topo-label').count();
    expect(labels).toBeGreaterThanOrEqual(1);
    // Should have topology legend
    await expect(page.locator('.topo-legend')).toBeVisible();
    await expect(page.locator('.topo-legend')).toContainText('Online');
    await page.screenshot({ path: 'test-results/fleet-topology.png' });
  });

  test('agent baton flow shows pipeline steps', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    const baton = page.locator('#panel-baton .baton-flow');
    await expect(baton).toBeVisible();
    // Should have 4 role steps
    const steps = await baton.locator('.baton-step').count();
    expect(steps).toBe(4);
    // Should have role labels
    await expect(baton).toContainText('Manager');
    await expect(baton).toContainText('Collaborator');
    await expect(baton).toContainText('Admin');
    await expect(baton).toContainText('Consultant');
    // Should have arrows between steps
    const arrows = await baton.locator('.baton-arrow').count();
    expect(arrows).toBe(3);
  });

  test('resource monitor shows OpenClaw and Tailscale', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    const resources = page.locator('#panel-resources');
    await expect(resources).toBeVisible();
    // Should have compact resource cards
    const cards = await resources.locator('.res-card').count();
    expect(cards).toBeGreaterThanOrEqual(2);
    // Should mention Tailscale
    await expect(resources).toContainText('Tailscale');
    // Should mention Ollama
    await expect(resources).toContainText('Ollama');
    await page.screenshot({ path: 'test-results/fleet-resources.png' });
  });

  test('fleet panels use 2-column grid layout', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    const topo = page.locator('#panel-topology');
    const box = await topo.boundingBox();
    // Half-width panels should be less than 600px at 960 viewport
    expect(box.width).toBeLessThan(600);
    expect(box.width).toBeGreaterThan(200);
  });

  test('view switching preserves fleet panel state', async ({ page }) => {
    await page.goto('http://localhost:8090/dashboard/');
    // Verify fleet view
    await expect(page.locator('#panel-topology')).toBeVisible();
    // Switch to ops then back
    await page.click('button:has-text("Ops")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Fleet")');
    await page.waitForTimeout(300);
    // Fleet panels restored
    await expect(page.locator('#panel-topology')).toBeVisible();
    await expect(page.locator('#panel-baton')).toBeVisible();
    await expect(page.locator('#panel-activity')).toBeVisible();
  });
});
