import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5173';

test('full login flow — landing → login → dashboard', async ({ page }) => {
  // 1. Landing page
  await page.goto(BASE + '/');
  await expect(page.locator('text=i-CFO360').first()).toBeVisible();

  // 2. Click Sign In → /login
  await page.locator('button', { hasText: /sign in/i }).first().click();
  await page.waitForURL('**/login');

  // 3. Switch to email tab
  await page.locator('button', { hasText: 'Email & Password' }).click();

  // 4. Use dev quick-fill button
  await page.locator('button', { hasText: /superadmin/i }).click();
  await expect(page.locator('input[type="email"]')).toHaveValue('admin@ria-advisory.com');

  // 5. Submit
  await page.locator('button[type="submit"]').click();

  // 6. Should land on /dashboard
  await page.waitForURL('**/dashboard', { timeout: 8000 });
  await expect(page.url()).toContain('/dashboard');

  // 7. AppShell should show user name
  await expect(page.locator('text=RIA Admin').first()).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/dashboard-logged-in.png', fullPage: false });
});

test('logout returns to login', async ({ page }) => {
  // Login first
  await page.goto(BASE + '/login');
  await page.locator('button', { hasText: 'Email & Password' }).click();
  await page.locator('button', { hasText: /superadmin/i }).click();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 8000 });

  // Click user dropdown
  await page.locator('text=RIA Admin').first().click();
  await page.locator('button', { hasText: 'Sign out' }).click();

  // Should be on /login
  await page.waitForURL('**/login', { timeout: 5000 });
  await expect(page.url()).toContain('/login');
  await page.screenshot({ path: 'tests/screenshots/after-logout.png' });
});
