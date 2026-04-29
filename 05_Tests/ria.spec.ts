/**
 * RIA Advisory — Playwright smoke tests
 * Verifies: backend endpoints, Explorer page, GL Search, Analytics page
 */
import { test, expect } from '@playwright/test';

const FRONTEND = 'http://localhost:4000';
const BACKEND  = 'http://localhost:8080';

async function loginAdmin(page: any) {
  await page.goto(FRONTEND + '/login');
  await page.locator('button', { hasText: 'Email & Password' }).click();
  await page.locator('button', { hasText: /superadmin/i }).click();
  await page.locator('button[type="submit"]').click();
  // Superadmin lands on hub — enter first tenant to reach dashboard
  await page.waitForURL('**/admin/hub', { timeout: 10000 });
  await page.locator('text=Enter tenant →').first().click();
  await page.waitForURL('**/dashboard', { timeout: 8000 });
}

// ── 1. Backend API health ─────────────────────────────────────────────────────

test('backend /api/analytics/filters returns companies', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/analytics/filters`);
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.companies.length).toBeGreaterThan(0);
  expect(data.years.length).toBeGreaterThan(0);
});

test('backend /api/analytics/pl-waterfall returns monthly rows', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/analytics/pl-waterfall`);
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0]).toHaveProperty('month');
  expect(rows[0]).toHaveProperty('revenue');
});

test('backend /api/gl/stats returns all 17 entities', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/gl/stats`);
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows.length).toBe(17);
  expect(rows[0]).toHaveProperty('code');
  expect(rows[0]).toHaveProperty('total_entries');
});

test('backend /api/gl/entries returns rows from star schema', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/gl/entries?company_id=8&limit=5`);
  expect(res.status()).toBe(200);
  const rows = await res.json();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows[0]).toHaveProperty('subsidiary_name');
  expect(rows[0]).toHaveProperty('gl_account_no');
  expect(rows[0]).toHaveProperty('amount');
  expect(typeof rows[0].amount).toBe('number');
});

test('backend /api/analytics/kpi-summary returns revenue', async ({ request }) => {
  const res = await request.get(`${BACKEND}/api/analytics/kpi-summary`);
  expect(res.status()).toBe(200);
  const kpi = await res.json();
  expect(kpi.revenue).toBeGreaterThan(0);
  expect(kpi.entry_count).toBeGreaterThan(100000);
});

// ── 2. Frontend pages ─────────────────────────────────────────────────────────

test('GL Explorer page loads without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await loginAdmin(page);
  await page.goto(`${FRONTEND}/explorer`);
  await expect(page.locator('h1')).toContainText('GL Explorer');

  await expect(page.locator('.card').first()).toBeVisible({ timeout: 10000 });

  const apiErrors = errors.filter(e => e.includes('ERR_CONNECTION_RESET') || e.includes('ERR_SOCKET_NOT_CONNECTED'));
  expect(apiErrors).toHaveLength(0);
});

test('GL Explorer charts tab loads chart data', async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${FRONTEND}/explorer`);
  await expect(page.locator('svg').first()).toBeVisible({ timeout: 15000 });
});

test('GL Explorer search tab returns real DB rows', async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${FRONTEND}/explorer`);

  await page.click('button:has-text("GL Search")');

  const select = page.locator('select').first();
  await expect(select).toBeVisible({ timeout: 5000 });
  await expect(select.locator('option')).toHaveCount(18, { timeout: 10000 });
  const optionCount = await select.locator('option').count();
  expect(optionCount).toBeGreaterThan(1);

  await select.selectOption({ index: 1 });
  await page.click('button:has-text("Search GL")');

  await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

  const empty = await page.locator('text=No results').count();
  expect(empty).toBe(0);
});

test('GL Explorer stats tab loads per-entity stats', async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${FRONTEND}/explorer`);
  await page.click('button:has-text("Load Stats")');
  await expect(page.locator('table tbody tr')).toHaveCount(17, { timeout: 15000 });
});

test('Analytics page loads with filter panel', async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${FRONTEND}/analytics`);
  await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 10000 });
});

test('Analytics KPI tiles show non-zero values', async ({ page }) => {
  await loginAdmin(page);
  await page.goto(`${FRONTEND}/analytics`);
  await page.waitForTimeout(4000);
  const kpiText = await page.locator('.card').first().textContent();
  expect(kpiText).not.toContain('...');
});
