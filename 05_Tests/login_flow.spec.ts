import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4000';

test('superadmin login → /admin/hub with tenant tiles', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('text=i-CFO360').first()).toBeVisible();

  await page.locator('button', { hasText: /sign in/i }).first().click();
  await page.waitForURL('**/login');

  await page.locator('button', { hasText: 'Email & Password' }).click();
  await page.locator('button', { hasText: /superadmin/i }).click();
  await expect(page.locator('input[type="email"]')).toHaveValue('admin@ria-advisory.com');

  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/admin/hub', { timeout: 8000 });
  await expect(page.url()).toContain('/admin/hub');

  await expect(page.locator('text=Select a tenant').first()).toBeVisible();
  await expect(page.locator('text=Enter tenant →').first()).toBeVisible();

  await page.screenshot({ path: 'screenshots/superadmin-hub.png', fullPage: false });
});

test('superadmin clicks tenant tile → enters dashboard', async ({ page }) => {
  await page.goto(BASE + '/login');
  await page.locator('button', { hasText: 'Email & Password' }).click();
  await page.locator('button', { hasText: /superadmin/i }).click();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/admin/hub', { timeout: 8000 });

  await page.locator('text=Enter tenant →').first().click();
  await page.waitForURL('**/dashboard', { timeout: 8000 });
  await expect(page.url()).toContain('/dashboard');

  await page.screenshot({ path: 'screenshots/dashboard-after-tenant-select.png' });
});

test('ria_admin login → /dashboard directly', async ({ page }) => {
  await page.goto(BASE + '/login');
  await page.locator('button', { hasText: 'Email & Password' }).click();
  await page.locator('button', { hasText: /ria admin/i }).click();
  await page.locator('button[type="submit"]').click();

  await page.waitForURL('**/dashboard', { timeout: 8000 });
  await expect(page.url()).toContain('/dashboard');
  await expect(page.locator('text=RIA Admin').first()).toBeVisible();

  await page.screenshot({ path: 'screenshots/dashboard-ria-admin.png', fullPage: false });
});

test('logout returns to login', async ({ page }) => {
  await page.goto(BASE + '/login');
  await page.locator('button', { hasText: 'Email & Password' }).click();
  await page.locator('button', { hasText: /ria admin/i }).click();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 8000 });

  await page.locator('text=RIA Admin').first().click();
  await page.locator('button', { hasText: 'Sign out' }).click();

  await page.waitForURL('**/login', { timeout: 5000 });
  await expect(page.url()).toContain('/login');
  await page.screenshot({ path: 'screenshots/after-logout.png' });
});
