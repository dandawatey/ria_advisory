import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5173';

test('superadmin login → /admin/hub with tenant tiles', async ({ page }) => {
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

  // 6. Superadmin lands on /admin/hub
  await page.waitForURL('**/admin/hub', { timeout: 8000 });
  await expect(page.url()).toContain('/admin/hub');

  // 7. Tenant tiles should show
  await expect(page.locator('text=Select a tenant').first()).toBeVisible();
  await expect(page.locator('text=Enter tenant →').first()).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/superadmin-hub.png', fullPage: false });
});

test('superadmin clicks tenant tile → enters dashboard', async ({ page }) => {
  await page.goto(BASE + '/login');
  await page.locator('button', { hasText: 'Email & Password' }).click();
  await page.locator('button', { hasText: /superadmin/i }).click();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/admin/hub', { timeout: 8000 });

  // Click first tenant tile (the main card area, not Configure/Users buttons)
  await page.locator('text=Enter tenant →').first().click();
  await page.waitForURL('**/dashboard', { timeout: 8000 });
  await expect(page.url()).toContain('/dashboard');

  await page.screenshot({ path: 'tests/screenshots/dashboard-after-tenant-select.png' });
});

test('ria_admin login → /dashboard directly', async ({ page }) => {
  await page.goto(BASE + '/login');
  await page.locator('button', { hasText: 'Email & Password' }).click();
  await page.locator('button', { hasText: /ria admin/i }).click();
  await page.locator('button[type="submit"]').click();

  await page.waitForURL('**/dashboard', { timeout: 8000 });
  await expect(page.url()).toContain('/dashboard');
  await expect(page.locator('text=RIA Admin').first()).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/dashboard-ria-admin.png', fullPage: false });
});

test('logout returns to login', async ({ page }) => {
  // Login as ria_admin (goes to /dashboard directly)
  await page.goto(BASE + '/login');
  await page.locator('button', { hasText: 'Email & Password' }).click();
  await page.locator('button', { hasText: /ria admin/i }).click();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 8000 });

  // Click user dropdown → sign out
  await page.locator('text=RIA Admin').first().click();
  await page.locator('button', { hasText: 'Sign out' }).click();

  await page.waitForURL('**/login', { timeout: 5000 });
  await expect(page.url()).toContain('/login');
  await page.screenshot({ path: 'tests/screenshots/after-logout.png' });
});
