// Baton step resource tooltips — fleet/cloud resource per baton role (#329)
const { test, expect } = require('@playwright/test');

const BATON_STUB_FLEET = {
  tickets: [{
    issue: 55, title: 'Fleet resource ticket', status: 'in-progress',
    agent: 'Claude Harper', model: 'qwen2.5-coder:7b',
    activeRole: 'collaborator',
    steps: [
      { id: 'manager', label: 'Manager', done: true },
      { id: 'collaborator', label: 'Collaborator', active: true },
      { id: 'admin', label: 'Admin', done: false },
      { id: 'consultant', label: 'Review', done: false },
    ],
  }],
};

const BATON_STUB_CLOUD = {
  tickets: [{
    issue: 56, title: 'Cloud resource ticket', status: 'in-progress',
    agent: 'Claude Harper', model: 'claude-sonnet-4-6',
    activeRole: 'collaborator',
    steps: BATON_STUB_FLEET.tickets[0].steps,
  }],
};

async function goLive(page, stub) {
  await page.route('**/api/baton', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(stub) })
  );
  await page.goto('/');
  const btn = page.locator('button[title="Live"]');
  if (await btn.count() > 0) await btn.click();
  await page.waitForTimeout(400);
}

test.describe('Baton step resource tooltips (#329)', () => {
  test('active step shows fleet resource type in title', async ({ page }) => {
    await goLive(page, BATON_STUB_FLEET);
    const activeStep = page.locator('.baton-step.active').first();
    await expect(activeStep).toBeVisible();
    const tip = await activeStep.getAttribute('title');
    expect(tip).toContain('fleet');
  });

  test('active step shows cloud resource type for cloud model', async ({ page }) => {
    await goLive(page, BATON_STUB_CLOUD);
    const activeStep = page.locator('.baton-step.active').first();
    await expect(activeStep).toBeVisible();
    const tip = await activeStep.getAttribute('title');
    expect(tip).toContain('cloud');
  });

  test('active step tooltip includes agent name', async ({ page }) => {
    await goLive(page, BATON_STUB_FLEET);
    const activeStep = page.locator('.baton-step.active').first();
    await expect(activeStep).toBeVisible();
    const tip = await activeStep.getAttribute('title');
    expect(tip).toContain('Claude Harper');
  });

  test('active step tooltip includes model name', async ({ page }) => {
    await goLive(page, BATON_STUB_FLEET);
    const activeStep = page.locator('.baton-step.active').first();
    const tip = await activeStep.getAttribute('title');
    expect(tip).toContain('qwen2.5-coder:7b');
  });

  test('done step tooltip shows completed status', async ({ page }) => {
    await goLive(page, BATON_STUB_FLEET);
    const doneStep = page.locator('.baton-step.done').first();
    if (await doneStep.count() > 0) {
      const tip = await doneStep.getAttribute('title');
      expect(tip).toContain('done');
    }
  });
});
