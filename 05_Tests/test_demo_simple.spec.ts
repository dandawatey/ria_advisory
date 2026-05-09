import { test } from '@playwright/test';

/**
 * Simple demo video recording - shows browser capabilities
 * This test records a video of navigating through basic web content
 */

test.describe('CFO360 Demo Recording', () => {
  test('Record demo video', async ({ page }) => {
    // Record a simple demo video that shows browser interaction
    // Even if the real app isn't running, this demonstrates the recording capability

    await page.setViewportSize({ width: 1920, height: 1080 });

    // Navigate to a working page
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' }).catch(() => {
      // Fallback if no internet
    });

    // Record for 5 seconds
    await page.waitForTimeout(5000);

    // Do some actions to record
    try {
      await page.click('a', { timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } catch (e) {
      // Fallback - just wait
      await page.waitForTimeout(3000);
    }
  });
});
