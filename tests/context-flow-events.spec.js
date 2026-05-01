// Context Flow event-animation wiring tests (#707)
const { test, expect } = require('@playwright/test');

test.describe('Context Flow event animations (#707)', () => {
  test('_cfMapEvent returns cloud nodes for baton:role with claude model', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      if (typeof _cfMapEvent !== 'function') return null;
      return _cfMapEvent({ type: 'baton:role', model: 'claude-sonnet-4-6' });
    });
    expect(result).toEqual([0, 1, 2]);
  });

  test('_cfMapEvent returns fleet nodes for baton:role with qwen model', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      if (typeof _cfMapEvent !== 'function') return null;
      return _cfMapEvent({ type: 'baton:role', model: 'qwen2.5-coder:7b' });
    });
    expect(result).toEqual([0, 1, 4, 5, 6]);
  });

  test('_cfMapEvent returns git nodes for git:commit event', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      if (typeof _cfMapEvent !== 'function') return null;
      return _cfMapEvent({ type: 'git:commit', model: '' });
    });
    expect(result).toEqual([0, 3]);
  });

  test('_cfMapEvent returns merge node for git:merge event', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      if (typeof _cfMapEvent !== 'function') return null;
      return _cfMapEvent({ type: 'git:merge', model: '' });
    });
    expect(result).toEqual([3]);
  });

  test('_cfMapEvent returns null for unrecognized event type', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
      if (typeof _cfMapEvent !== 'function') return 'undefined-fn';
      return _cfMapEvent({ type: 'refresh', model: '' });
    });
    expect(result).toBeNull();
  });
});
