import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5173';

test.describe('i-CFO360 smoke tests', () => {

  test('landing page renders', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('text=i-CFO360').first()).toBeVisible();
    await page.screenshot({ path: 'screenshots/landing.png', fullPage: true });
  });

  test('landing CTA navigates to login', async ({ page }) => {
    await page.goto(BASE + '/');
    const cta = page.locator('button', { hasText: /sign in|get started/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    await page.waitForURL('**/login', { timeout: 5000 });
    await page.screenshot({ path: 'screenshots/login.png', fullPage: true });
  });

  test('login page renders both tabs', async ({ page }) => {
    await page.goto(BASE + '/login');
    await expect(page.locator('text=Microsoft SSO')).toBeVisible();
    await expect(page.locator('text=Email & Password')).toBeVisible();
    await page.screenshot({ path: 'screenshots/login-tabs.png', fullPage: true });
  });

  test('email tab shows form fields', async ({ page }) => {
    await page.goto(BASE + '/login');
    await page.locator('button', { hasText: 'Email & Password' }).click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await page.screenshot({ path: 'screenshots/login-email-tab.png', fullPage: true });
  });

  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto(BASE + '/dashboard');
    await page.waitForURL('**/login', { timeout: 5000 });
    await expect(page.url()).toContain('/login');
  });

});
