const { test, expect } = require('@playwright/test');

test.describe('Accessibility baseline (WCAG 2.2 AA guardrails)', () => {
  test('images expose non-empty alt text', async ({ page }) => {
    await page.goto('/');
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i += 1) {
      await expect(images.nth(i)).toHaveAttribute('alt', /\S+/);
    }
  });

  test('interactive controls are nameable by assistive tech', async ({ page }) => {
    await page.goto('/');
    const buttons = page.locator('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i += 1) {
      const b = buttons.nth(i);
      const aria = (await b.getAttribute('aria-label')) || '';
      const title = (await b.getAttribute('title')) || '';
      const text = ((await b.textContent()) || '').trim();
      expect((aria + title + text).trim().length).toBeGreaterThan(0);
    }
  });

  test('main heading and page title are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Megingjord');
    await expect(page).toHaveTitle(/Megingjord/i);
  });
});
