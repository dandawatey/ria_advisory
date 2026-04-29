import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5173';

// ── Helpers ────────────────────────────────────────────────────────────────

async function loginAs(page: any, role: 'superadmin' | 'ria_admin' | 'isource_admin') {
  await page.goto(BASE + '/login');
  await page.locator('button', { hasText: 'Email & Password' }).click();

  const btn = {
    superadmin:    /superadmin/i,
    ria_admin:     /ria admin/i,
    isource_admin: /isource admin/i,
  }[role];

  await page.locator('button', { hasText: btn }).click();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

// ── Role badge tests ───────────────────────────────────────────────────────

test('superadmin — AppShell shows "Super Admin" badge', async ({ page }) => {
  await loginAs(page, 'superadmin');
  await expect(page.locator('text=Super Admin').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/role-superadmin.png' });
});

test('ria_admin — AppShell shows "RIA Admin" badge', async ({ page }) => {
  await loginAs(page, 'ria_admin');
  await expect(page.locator('text=RIA Admin').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/role-ria-admin.png' });
});

test('isource_admin — AppShell shows "iSource Admin" badge', async ({ page }) => {
  await loginAs(page, 'isource_admin');
  await expect(page.locator('text=iSource Admin').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/role-isource-admin.png' });
});

// ── Tenant Management + Configure button ──────────────────────────────────

test('superadmin — Tenant Management shows Configure button', async ({ page }) => {
  await loginAs(page, 'superadmin');
  await page.goto(BASE + '/admin/tenants');
  await page.waitForSelector('table', { timeout: 8000 });
  await expect(page.locator('button', { hasText: 'Configure' }).first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/tenant-list-configure-btn.png' });
});

// ── Tenant Config page — 4 tabs ───────────────────────────────────────────

test('superadmin — TenantConfig page loads with 4 tabs', async ({ page }) => {
  await loginAs(page, 'superadmin');
  await page.goto(BASE + '/admin/tenants');
  await page.waitForSelector('table', { timeout: 8000 });

  // Click Configure on first tenant
  await page.locator('button', { hasText: 'Configure' }).first().click();
  await page.waitForURL('**/config', { timeout: 6000 });

  // All 4 tabs should be visible
  await expect(page.locator('button', { hasText: 'Branding' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'BC Dynamics' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'Subsidiaries' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'Plan & Billing' })).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/tenant-config-branding.png' });
});

test('TenantConfig — BC Dynamics tab shows status badge', async ({ page }) => {
  await loginAs(page, 'superadmin');
  await page.goto(BASE + '/admin/tenants');
  await page.waitForSelector('table', { timeout: 8000 });
  await page.locator('button', { hasText: 'Configure' }).first().click();
  await page.waitForURL('**/config', { timeout: 6000 });

  await page.locator('button', { hasText: 'BC Dynamics' }).click();
  // Status badge should be visible (pending/authenticated/error)
  await expect(page.locator('text=Status:').first()).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/tenant-config-bc.png' });
});

test('TenantConfig — Subsidiaries tab shows checkboxes', async ({ page }) => {
  await loginAs(page, 'superadmin');
  await page.goto(BASE + '/admin/tenants');
  await page.waitForSelector('table', { timeout: 8000 });
  await page.locator('button', { hasText: 'Configure' }).first().click();
  await page.waitForURL('**/config', { timeout: 6000 });

  await page.locator('button', { hasText: 'Subsidiaries' }).click();
  await expect(page.locator('button', { hasText: 'Select All' })).toBeVisible();
  await expect(page.locator('label', { hasText: 'RIA001' })).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/tenant-config-subsidiaries.png' });
});

test('TenantConfig — Plan & Billing tab shows billing fields', async ({ page }) => {
  await loginAs(page, 'superadmin');
  await page.goto(BASE + '/admin/tenants');
  await page.waitForSelector('table', { timeout: 8000 });
  await page.locator('button', { hasText: 'Configure' }).first().click();
  await page.waitForURL('**/config', { timeout: 6000 });

  await page.locator('button', { hasText: 'Plan & Billing' }).click();
  await expect(page.locator('label', { hasText: 'Max Users' })).toBeVisible();
  await expect(page.locator('label', { hasText: 'Auto-renew' })).toBeVisible();
  await page.screenshot({ path: 'tests/screenshots/tenant-config-billing.png' });
});

// ── Logo tests ────────────────────────────────────────────────────────────

test('ria_admin — sidebar shows RIA Advisory logo', async ({ page }) => {
  await loginAs(page, 'ria_admin');
  const logo = page.locator('.app-sidebar img').first();
  await expect(logo).toHaveAttribute('alt', 'RIA Advisory');
  await page.screenshot({ path: 'tests/screenshots/sidebar-ria-logo.png' });
});

test('isource_admin — sidebar shows iSource Infosystems logo', async ({ page }) => {
  await loginAs(page, 'isource_admin');
  const logo = page.locator('.app-sidebar img').first();
  await expect(logo).toHaveAttribute('alt', 'i-Source Infosystems');
  await page.screenshot({ path: 'tests/screenshots/sidebar-isource-logo.png' });
});

// ── isource_admin config access ───────────────────────────────────────────

test('isource_admin — can access own tenant config', async ({ page }) => {
  await loginAs(page, 'isource_admin');

  // Navigate to tenant list — isource_admin should see it via menu or direct URL
  // Get tenant id from URL after clicking configure in tenant management
  await page.goto(BASE + '/admin/tenants');
  // isource_admin may not see Tenant Management (superadmin only)
  // so test direct config URL with the iSource tenant id
  const tenantRes = await page.request.get('http://127.0.0.1:8000/api/tenants', {
    headers: { Authorization: `Bearer ${await getToken(page, 'isource_admin')}` },
  });

  if (tenantRes.ok()) {
    const tenants = await tenantRes.json();
    const isource = tenants.find((t: any) => t.slug === 'isource');
    if (isource) {
      await page.goto(BASE + `/admin/tenants/${isource.id}/config`);
      await expect(page.locator('button', { hasText: 'Branding' })).toBeVisible({ timeout: 8000 });
      await page.screenshot({ path: 'tests/screenshots/isource-admin-config.png' });
    }
  }
});

// ── Helper to get a fresh token via API ───────────────────────────────────

async function getToken(page: any, role: 'superadmin' | 'ria_admin' | 'isource_admin'): Promise<string> {
  const creds = {
    superadmin:    { email: 'admin@ria-advisory.com', password: 'Admin@2026' },
    ria_admin:     { email: 'admin@ria-admin.com',     password: 'Admin@2026' },
    isource_admin: { email: 'admin@isource.com',       password: 'Admin@2026' },
  }[role];

  const res = await page.request.post('http://127.0.0.1:8000/auth/login', {
    data: creds,
  });
  const body = await res.json();
  return body.access_token ?? '';
}
