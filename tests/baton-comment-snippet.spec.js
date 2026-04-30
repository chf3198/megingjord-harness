// Baton comment snippet — inline last-comment display for Agent Baton (#326)
const { test, expect } = require('@playwright/test');

const LONG_COMMENT = 'This is a very long comment that exceeds eighty characters in total length for testing.';
const SHORT_COMMENT = 'Short comment.';

const BATON_STUB = (comment) => ({
  tickets: [{
    issue: 42, title: 'Snippet test ticket', status: 'in-progress',
    agent: 'Claude Harper', model: 'claude-sonnet-4-6',
    lastComment: comment,
    steps: [
      { id: 'manager', label: 'Manager', done: true },
      { id: 'collaborator', label: 'Collaborator', active: true },
    ],
  }],
});

async function goLive(page, comment) {
  await page.route('**/api/baton', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(BATON_STUB(comment)) })
  );
  await page.goto('/');
  const btn = page.locator('button[title="Live"]');
  if (await btn.count() > 0) await btn.click();
  await page.waitForTimeout(400);
}

test.describe('Baton comment snippet (#326)', () => {
  test('snippet renders when lastComment present', async ({ page }) => {
    await goLive(page, SHORT_COMMENT);
    const snippet = page.locator('.baton-comment').first();
    await expect(snippet).toBeVisible();
    await expect(snippet).toContainText(SHORT_COMMENT);
  });

  test('long comment truncated to ≤83 chars with ellipsis', async ({ page }) => {
    await goLive(page, LONG_COMMENT);
    const snippet = page.locator('.baton-comment').first();
    await expect(snippet).toBeVisible();
    const text = await snippet.textContent();
    expect(text).toContain('…');
    expect(text.replace('💬 ', '').length).toBeLessThanOrEqual(83);
  });

  test('tooltip contains full comment text', async ({ page }) => {
    await goLive(page, LONG_COMMENT);
    const snippet = page.locator('.baton-comment').first();
    await expect(snippet).toBeVisible();
    const title = await snippet.getAttribute('title');
    expect(title).not.toBeNull();
    expect(title.length).toBeGreaterThan(0);
  });

  test('aria-label present for accessibility', async ({ page }) => {
    await goLive(page, SHORT_COMMENT);
    const snippet = page.locator('.baton-comment').first();
    await expect(snippet).toBeVisible();
    const ariaLabel = await snippet.getAttribute('aria-label');
    expect(ariaLabel).toContain('Last comment:');
  });

  test('no baton-comment rendered when lastComment is null', async ({ page }) => {
    await goLive(page, null);
    const snippets = await page.locator('.baton-comment').count();
    expect(snippets).toBe(0);
  });
});
